"""Headscale (Tailscale control plane) — OIDC secret, config, subnet-router key."""
from __future__ import annotations

import os

from setup.service import Service, VolumeDir, restore_sqlite_snapshot, sqlite_snapshot
from setup.ui import info, ok, section, step, warn
from setup.utils import (
    append_env,
    compose_up,
    docker_exec,
    gen_secret,
    run_cmd,
    substitute_env_vars,
    wait_for,
    wait_for_container_healthy,
)

ROUTER_USER = "subnet-router"
AUTHKEY_SECRET = "headscale_router_authkey"
CONFIG_TEMPLATE = "./headscale/config.yaml.template"
CONFIG_PATH = "./headscale/volumes/config/config.yaml"
CA_BUNDLE_PATH = "./headscale/volumes/config/ca-bundle.crt"


def _write_ca_bundle() -> None:
    """System roots + optional homelab CA so OIDC works in public or private SSL mode."""
    chunks: list[bytes] = []
    for path in (
        "/etc/ssl/certs/ca-certificates.crt",
        "/etc/ssl/cert.pem",
        "./volumes/certificates/homelab-ca.crt",
    ):
        if not os.path.isfile(path):
            continue
        with open(path, "rb") as f:
            data = f.read().strip()
        if data:
            chunks.append(data)
    os.makedirs(os.path.dirname(CA_BUNDLE_PATH), exist_ok=True)
    with open(CA_BUNDLE_PATH, "wb") as f:
        f.write(b"\n".join(chunks) + b"\n")
    os.chmod(CA_BUNDLE_PATH, 0o644)


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
        "HOMELAB_HOSTNAME",
        "AUTHENTIK_SERVICE_NAME",
        "HOMELAB_IP_ADDRESS",
        "HEADSCALE_BASE_DOMAIN",
        "DOCKER_SUBNET",
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
    for user in users:
        if user.get("name") == ROUTER_USER:
            return str(user.get("id", ""))
    return ""


def _ensure_router_user() -> str:
    user_id = _router_user_id()
    if user_id:
        return user_id
    _hs("users", "create", ROUTER_USER, "--display-name", "Homelab Subnet Router")
    ok(f"Created Headscale user `{ROUTER_USER}`")
    return _router_user_id()


def _ensure_router_authkey(user_id: str) -> str:
    """Return a reusable preauth key for the subnet router; create if needed."""
    secret_path = f"./volumes/secrets/{AUTHKEY_SECRET}"
    if os.path.isfile(secret_path):
        with open(secret_path, encoding="utf-8") as f:
            existing = f.read().strip()
        if existing and existing != "placeholder":
            return existing

    # 90-day reusable key; rotate by deleting the secret and re-running setup.
    # headscale 0.29 expects the numeric user id, not the name.
    key = _hs(
        "preauthkeys",
        "create",
        "--user",
        user_id,
        "--reusable",
        "--expiration",
        "2160h",
    ).strip()
    if not key:
        raise RuntimeError("headscale preauthkeys create returned empty key")

    os.makedirs("./volumes/secrets", exist_ok=True)
    with open(secret_path, "w", encoding="utf-8") as f:
        f.write(key)
    os.chmod(secret_path, 0o600)
    ok(f"Wrote subnet-router auth key → volumes/secrets/{AUTHKEY_SECRET}")
    return key


def _router_node_id() -> str:
    """Numeric id of the subnet-router node ('' if not registered)."""
    import json

    raw = _hs("nodes", "list", "-o", "json", check=False) or "[]"
    try:
        nodes = json.loads(raw)
    except ValueError:
        return ""
    for node in nodes:
        names = " ".join(
            str(node.get(key) or "") for key in ("name", "given_name", "hostname")
        ).lower()
        user = str((node.get("user") or {}).get("name", ""))
        if "homelab-router" in names or user == ROUTER_USER:
            return str(node.get("id", ""))
    return ""


def _approve_lan_routes(lan_subnet: str) -> None:
    """Enable advertised LAN and exit node routes on the subnet-router node."""
    if not lan_subnet:
        return
    # Wait briefly for the router to register and advertise.
    node_id = ""
    if wait_for(lambda: bool(_router_node_id()), timeout=60, interval=2):
        node_id = _router_node_id()

    if not node_id:
        warn(
            "Subnet router node not registered yet — "
            "approve routes later with: "
            f"docker exec headscale headscale nodes approve-routes "
            f"--identifier <id> --routes {lan_subnet},0.0.0.0/0,::/0"
        )
        return

    _hs(
        "nodes",
        "approve-routes",
        "--identifier",
        node_id,
        "--routes",
        f"{lan_subnet},0.0.0.0/0,::/0",
        check=False,
    )
    ok(f"Approved LAN route {lan_subnet} and exit node routes (0.0.0.0/0, ::/0) on node {node_id}")


class HeadscaleService(Service):
    name = "headscale"
    volume_dirs = [
        VolumeDir("./headscale/volumes/config", mode=0o755),
        VolumeDir("./headscale/volumes/data", mode=0o700),
        VolumeDir("./headscale/volumes/router", mode=0o700),
    ]

    def setup(self, env: dict) -> None:
        super().setup(env)
        section("Preparing Headscale (Tailscale control plane)...", emoji="🛰️")
        os.makedirs("./volumes/secrets", exist_ok=True)
        gen_secret("headscale_oidc_secret", 64)

        # Placeholder so Compose can mount the secret before postsetup fills it.
        authkey_path = f"./volumes/secrets/{AUTHKEY_SECRET}"
        if not os.path.isfile(authkey_path):
            with open(authkey_path, "w", encoding="utf-8") as f:
                f.write("placeholder")
            os.chmod(authkey_path, 0o600)

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
        _write_ca_bundle()
        ok(f"Wrote {CONFIG_PATH}")
        ok(f"Wrote {CA_BUNDLE_PATH}")
        info("Clients: Tailscale app → custom control URL")
        step(f"https://{env.get('HEADSCALE_WEB_HOSTNAME', 'vpn.homelab.local')}")
        info("Sign-in uses Authentik (same users/groups as SSO)")

    def postsetup(self, env: dict) -> None:
        section("Headscale postsetup (subnet router)...", emoji="🛰️")
        if not wait_for_container_healthy("headscale", timeout=120):
            warn("Headscale not healthy yet — skip router key provisioning")
            return

        try:
            user_id = _ensure_router_user()
            if not user_id:
                raise RuntimeError(f"user `{ROUTER_USER}` not found after create")
            _ensure_router_authkey(user_id)
        except Exception as exc:
            warn(f"Failed to provision router auth key: {exc}")
            return

        compose_up(
            "headscale-router",
            profiles=("headscale-router",),
            force_recreate=True,
            check=False,
        )
        # TS_AUTH_ONCE skips `tailscale up` after first login, so compose-env
        # flag changes won't reapply — set prefs explicitly once the daemon is up.
        wait_for(
            lambda: '"BackendState": "Running"'
            in (run_cmd(
                "docker exec headscale-router tailscale status --json",
                check=False,
            ) or ""),
            timeout=60,
            interval=2,
        )
        docker_exec(
            "headscale-router",
            "tailscale",
            "set",
            "--netfilter-mode=off",
            "--snat-subnet-routes=false",
            check=False,
        )
        _approve_lan_routes(env.get("LAN_SUBNET") or os.environ.get("LAN_SUBNET", ""))

    def backup(self, env: dict) -> None:
        sqlite_snapshot(
            "headscale",
            "/var/lib/headscale/db.sqlite",
            "/var/lib/headscale/db_snapshot.sqlite",
            host_bind="./headscale/volumes/data",
        )

    def restore(self, env: dict) -> None:
        restore_sqlite_snapshot(
            "headscale",
            "/var/lib/headscale/db.sqlite",
            "./headscale/volumes/data/db_snapshot.sqlite",
            "./headscale/volumes/data",
        )


service = HeadscaleService()
