"""Headscale (Tailscale control plane) — OIDC secret, config, subnet-router key."""
from __future__ import annotations

import os
import shlex

from setup.service import Service, VolumeDir, restore_sqlite_snapshot, sqlite_snapshot
from setup.ui import ok, warn
from setup.utils import (
    append_env,
    compose_up,
    docker_exec,
    gen_secret,
    run_cmd,
    substitute_env_vars,
    wait_for,
    wait_for_container_healthy,
    write_ca_bundle,
)

ROUTER_USER = "subnet-router"
AUTHKEY_SECRET = "headscale_router_authkey"
ROUTER_ENV_PATH = "./services/headscale/volumes/config/router.env"
CONFIG_TEMPLATE = "./services/headscale/config.yaml.template"
CONFIG_PATH = "./services/headscale/volumes/config/config.yaml"
CA_BUNDLE_PATH = "./services/headscale/volumes/config/ca-bundle.crt"


def _write_config(env: dict) -> None:
    """Render config.yaml from template using current environment."""
    base_domain = env.get("HEADSCALE_BASE_DOMAIN") or ""
    if not base_domain:
        dns_domain = env.get("DNS_DOMAIN") or ""
        base_domain = f"ts.{dns_domain}" if dns_domain else "ts.home.arpa"
        env["HEADSCALE_BASE_DOMAIN"] = base_domain
        os.environ["HEADSCALE_BASE_DOMAIN"] = base_domain

    # Existing installations are backfilled by ensure_bootstrap_and_locale;
    # retain safe rendering defaults for direct service-level use.
    os.environ.setdefault("LAN_SUBNET", env.get("LAN_SUBNET") or "10.10.10.0/24")
    os.environ.setdefault("DOCKER_SUBNET", env.get("DOCKER_SUBNET") or "10.10.30.0/24")
    os.environ.setdefault(
        "HEADSCALE_IPV4_PREFIX",
        env.get("HEADSCALE_IPV4_PREFIX") or "100.64.0.0/24",
    )

    for key in (
        "HEADSCALE_SERVICE_NAME",
        "HEADSCALE_WEB_HOSTNAME",
        "HOMELAB_HOSTNAME",
        "AUTHENTIK_SERVICE_NAME",
        "HOMELAB_IP_ADDRESS",
        "HEADSCALE_BASE_DOMAIN",
        "DOCKER_SUBNET",
        "LAN_SUBNET",
        "HEADSCALE_IPV4_PREFIX",
    ):
        if env.get(key):
            os.environ[key] = env[key]

    with open(CONFIG_TEMPLATE, encoding="utf-8") as f:
        content = substitute_env_vars(f.read())

    os.makedirs(os.path.dirname(CONFIG_PATH), exist_ok=True)
    with open(CONFIG_PATH, "w", encoding="utf-8") as f:
        f.write(content)
    os.chmod(CONFIG_PATH, 0o600)


def _hs(*args: str, check: bool = True) -> str:
    return docker_exec("headscale", "headscale", *args, check=check)


def _router_user_id() -> str:
    """Numeric id of the subnet-router user ('' if absent)."""
    import json

    raw = _hs("users", "list", "-o", "json", check=False) or "[]"
    try:
        users = json.loads(raw)
    except ValueError:
        return ""
    if not users:
        return ""
    for user in users:
        if user.get("name") == ROUTER_USER:
            return str(user.get("id", ""))
    return ""


def _ensure_router_user() -> str:
    user_id = _router_user_id()
    if user_id:
        return user_id
    _hs("users", "create", ROUTER_USER, "--display-name", "Homelab Subnet Router")
    return _router_user_id()


def _ensure_router_authkey(user_id: str, *, rotate: bool = False) -> str:
    """Return a reusable preauth key for the subnet router; create if needed.

    Always parse `preauthkeys create -o json` so we never write CLI noise/ANSI
    into the secret file (that yields Headscale's "invalid pre auth key").
    """
    import json

    secret_path = f"./volumes/secrets/{AUTHKEY_SECRET}"
    if not rotate and os.path.isfile(secret_path):
        with open(secret_path, encoding="utf-8") as f:
            existing = f.read().strip()
        if existing.startswith("hskey-auth-"):
            return existing

    # 90-day reusable key; rotate by deleting the secret and re-running setup.
    # headscale 0.29 expects the numeric user id, not the name.
    raw = _hs(
        "preauthkeys",
        "create",
        "--user",
        user_id,
        "--reusable",
        "--expiration",
        "2160h",
        "-o",
        "json",
    )
    try:
        payload = json.loads(raw or "{}")
        key = str(payload.get("key") or "").strip()
    except ValueError as exc:
        raise RuntimeError(f"headscale preauthkeys create returned non-JSON: {raw!r}") from exc
    if not key.startswith("hskey-auth-"):
        raise RuntimeError(f"headscale preauthkeys create returned unexpected key shape")

    os.makedirs("./volumes/secrets", exist_ok=True)
    with open(secret_path, "w", encoding="utf-8") as f:
        f.write(key)
        f.write("\n")
        f.flush()
        os.fsync(f.fileno())
    os.chmod(secret_path, 0o600)

    # Env file consumed by headscale-router compose (more reliable than secret mounts).
    os.makedirs(os.path.dirname(ROUTER_ENV_PATH), exist_ok=True)
    with open(ROUTER_ENV_PATH, "w", encoding="utf-8") as f:
        f.write(f"TS_AUTHKEY={key}\n")
        f.flush()
        os.fsync(f.fileno())
    os.chmod(ROUTER_ENV_PATH, 0o600)
    return key


def _reset_router_state() -> None:
    """Clear local Tailscale state so a failed placeholder login cannot stick.

    The router runs as root (network_mode: host), so state files are root-owned.
    """
    router_dir = "./services/headscale/volumes/router"
    run_cmd(f"sudo rm -rf {shlex.quote(router_dir)}", check=False)
    os.makedirs(router_dir, mode=0o700, exist_ok=True)
    run_cmd(
        f"sudo chown {os.getuid()}:{os.getgid()} {shlex.quote(router_dir)}",
        check=False,
    )


def _list_router_nodes() -> list[dict]:
    """Nodes belonging to the subnet-router user / homelab-router hostname."""
    import json

    raw = _hs("nodes", "list", "-o", "json", check=False) or "[]"
    try:
        nodes = json.loads(raw)
    except ValueError:
        return []
    out: list[dict] = []
    for node in nodes or []:
        names = " ".join(
            str(node.get(key) or "") for key in ("name", "given_name", "hostname")
        ).lower()
        user = str((node.get("user") or {}).get("name", ""))
        if "homelab-router" in names or user == ROUTER_USER:
            out.append(node)
    return out


def _router_node_id() -> str:
    """Numeric id of the live subnet-router node ('' if not registered).

    Prefer an online node; otherwise the highest id (newest registration).
    Older offline homelab-router / -1 / -2 leftovers must not win approval.
    """
    nodes = _list_router_nodes()
    if not nodes:
        return ""
    online = [n for n in nodes if n.get("online")]
    pick = online[0] if online else max(nodes, key=lambda n: int(n.get("id") or 0))
    return str(pick.get("id", "") or "")


def _delete_router_nodes() -> None:
    """Remove all subnet-router nodes so a reprovision does not leave duplicates."""
    for node in _list_router_nodes():
        nid = str(node.get("id", "") or "")
        if not nid:
            continue
        _hs("nodes", "delete", "--identifier", nid, "--force", check=False)


def _approve_lan_routes(lan_subnet: str) -> None:
    """Enable advertised LAN and exit node routes on the subnet-router node."""
    if not lan_subnet:
        return
    # Wait for the router to register and advertise (auth + DERP can take a bit).
    node_id = ""
    if wait_for(lambda: bool(_router_node_id()), timeout=120, interval=3):
        node_id = _router_node_id()

    if not node_id:
        warn(
            "Subnet router node not registered yet — "
            "approve routes later with: "
            f"docker exec headscale headscale nodes approve-routes "
            f"--identifier <id> --routes {lan_subnet},0.0.0.0/0,::/0"
        )
        return

    # Drop offline duplicates from earlier postsetup runs (homelab-router-N).
    for node in _list_router_nodes():
        nid = str(node.get("id", "") or "")
        if nid and nid != node_id:
            _hs("nodes", "delete", "--identifier", nid, "--force", check=False)

    _hs(
        "nodes",
        "approve-routes",
        "--identifier",
        node_id,
        "--routes",
        f"{lan_subnet},0.0.0.0/0,::/0",
        check=False,
    )
    # Stable name in the Tailscale UI (avoids homelab-router-2 after renumbers).
    _hs("nodes", "rename", "homelab-router", "--identifier", node_id, check=False)


class HeadscaleService(Service):
    name = "headscale"
    volume_dirs = [
        VolumeDir("./services/headscale/volumes/config", mode=0o755),
        VolumeDir("./services/headscale/volumes/data", mode=0o700),
        VolumeDir("./services/headscale/volumes/router", mode=0o700),
    ]

    def setup(self, env: dict) -> None:
        super().setup(env)
        os.makedirs("./volumes/secrets", exist_ok=True)
        gen_secret("headscale_oidc_secret", 64)

        # Placeholder so Compose can mount the secret before postsetup fills it.
        authkey_path = f"./volumes/secrets/{AUTHKEY_SECRET}"
        if not os.path.isfile(authkey_path):
            with open(authkey_path, "w", encoding="utf-8") as f:
                f.write("placeholder")
            os.chmod(authkey_path, 0o600)

        # Placeholder env file so `compose --profile headscale-router config` works
        # before postsetup writes the real TS_AUTHKEY.
        if not os.path.isfile(ROUTER_ENV_PATH):
            os.makedirs(os.path.dirname(ROUTER_ENV_PATH), exist_ok=True)
            with open(ROUTER_ENV_PATH, "w", encoding="utf-8") as f:
                f.write("TS_AUTHKEY=placeholder\n")
            os.chmod(ROUTER_ENV_PATH, 0o600)

        # Persist LAN_SUBNET into .env if missing (used by compose + config).
        if not env.get("LAN_SUBNET"):
            append_env(env, "LAN_SUBNET", os.environ.get("LAN_SUBNET", "10.10.10.0/24"))

        if not env.get("HEADSCALE_BASE_DOMAIN"):
            dns_domain = env.get("DNS_DOMAIN") or "home.arpa"
            append_env(env, "HEADSCALE_BASE_DOMAIN", f"ts.{dns_domain}")

        if not env.get("HEADSCALE_SERVICE_NAME"):
            append_env(env, "HEADSCALE_SERVICE_NAME", "vpn")

        if not env.get("HEADSCALE_WEB_HOSTNAME"):
            dns_domain = env.get("DNS_DOMAIN") or "home.arpa"
            hostname = env.get("HOMELAB_HOSTNAME") or f"homelab.{dns_domain}"
            append_env(env, "HEADSCALE_WEB_HOSTNAME", f"vpn.{hostname}")

        _write_config(env)
        write_ca_bundle(CA_BUNDLE_PATH)

    def postsetup(self, env: dict) -> None:
        if not wait_for_container_healthy("headscale", timeout=120):
            warn("Headscale not healthy yet — skip router key provisioning")
            return

        # Headscale only initializes OIDC at process start. With
        # only_start_if_oidc_is_available: false it may have fallen back to CLI
        # register while Authentik blueprints were still applying — restart once
        # discovery works so Tailscale clients get OIDC.
        auth = env.get("AUTHENTIK_SERVICE_NAME") or "auth"
        host = env.get("HOMELAB_HOSTNAME") or ""
        if host:
            oidc_url = (
                f"https://{auth}.{host}/application/o/headscale/"
                ".well-known/openid-configuration"
            )
            if wait_for(
                lambda: '"issuer"'
                in (run_cmd(f"curl -sf {shlex.quote(oidc_url)}", check=False) or ""),
                timeout=180,
                interval=5,
            ):
                run_cmd("docker restart headscale", check=False)
                if not wait_for_container_healthy("headscale", timeout=120):
                    warn("Headscale unhealthy after OIDC reload — continue anyway")
                elif "falling back to CLI" in (
                    run_cmd("docker logs headscale --since 2m", check=False) or ""
                ):
                    warn(
                        "Headscale still falling back to CLI auth after OIDC reload — "
                        "check TLS to Authentik (ca-bundle) and Traefik certs"
                    )
                else:
                    ok("Headscale OIDC reloaded")
            else:
                warn(f"Authentik Headscale OIDC not reachable yet ({oidc_url})")

        try:
            user_id = _ensure_router_user()
            if not user_id:
                raise RuntimeError(f"user `{ROUTER_USER}` not found after create")
            # Always mint a fresh key on postsetup — a leftover placeholder or
            # corrupt secret is the usual cause of "invalid pre auth key".
            _ensure_router_authkey(user_id, rotate=True)
        except Exception as exc:
            warn(f"Failed to provision router auth key: {exc}")
            return

        # Stop any prior attempt (placeholder key / failed login) and wipe state
        # so TS_AUTH_ONCE cannot skip re-auth with a logged-out node. Delete
        # existing router nodes first — each wipe+reauth otherwise creates
        # homelab-router-N leftovers with exit routes stuck on the offline one.
        run_cmd(
            "docker compose --profile headscale-router stop headscale-router",
            check=False,
        )
        _delete_router_nodes()
        _reset_router_state()

        compose_up(
            "headscale-router",
            profiles=("headscale-router",),
            force_recreate=True,
            check=False,
        )
        # Wait until the daemon is running *and* Headscale sees the node.
        if not wait_for(
            lambda: '"BackendState": "Running"'
            in (
                run_cmd(
                    "docker exec headscale-router tailscale --socket=/tmp/tailscaled.sock status --json",
                    check=False,
                )
                or ""
            ),
            timeout=90,
            interval=3,
        ):
            logs = run_cmd("docker logs headscale-router --tail 30", check=False) or ""
            warn("headscale-router did not reach Running state")
            if logs:
                warn(logs[-800:].strip())
            return

        docker_exec(
            "headscale-router",
            "tailscale",
            "--socket=/tmp/tailscaled.sock",
            "set",
            "--netfilter-mode=off",
            "--snat-subnet-routes=false",
            check=False,
        )
        _approve_lan_routes(env.get("LAN_SUBNET") or os.environ.get("LAN_SUBNET", ""))
        ok("Headscale subnet router provisioned")

    def backup(self, env: dict) -> None:
        sqlite_snapshot(
            "headscale",
            "/var/lib/headscale/db.sqlite",
            "/var/lib/headscale/db_snapshot.sqlite",
            host_bind="./services/headscale/volumes/data",
        )

    def restore(self, env: dict) -> None:
        restore_sqlite_snapshot(
            "headscale",
            "/var/lib/headscale/db.sqlite",
            "./services/headscale/volumes/data/db_snapshot.sqlite",
            "./services/headscale/volumes/data",
        )


service = HeadscaleService()
