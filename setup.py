#!/usr/bin/env python3
"""Homelab orchestration: setup, backup, and restore."""
from __future__ import annotations

import argparse
import ipaddress
import os
import re
import shutil
import subprocess
import sys

from setup.ui import banner, error, ok, section, skip, step, warn


def _parse_ipv4_network(value: str) -> ipaddress.IPv4Network | None:
    """IPv4-only CIDR parse (IPv6 raises ValueError in IPv4Network)."""
    try:
        return ipaddress.IPv4Network(value, strict=True)
    except ValueError:
        return None


def _validate_ipv4_cidr(value: str) -> str | None:
    if _parse_ipv4_network(value) is None:
        return "Use an IPv4 network in CIDR form, e.g. 10.10.10.0/24"
    return None


def _validate_docker_subnet(value: str) -> str | None:
    network = _parse_ipv4_network(value)
    if network is None:
        return "Use an IPv4 network in CIDR form, e.g. 10.10.10.0/24"
    if network.num_addresses < 128:
        return "Use /25 or larger so the reserved Traefik address fits."
    return None


def _validate_headscale_prefix(value: str) -> str | None:
    network = _parse_ipv4_network(value)
    if network is None:
        return "Use an IPv4 network in CIDR form, e.g. 10.10.10.0/24"
    if not network.subnet_of(ipaddress.IPv4Network("100.64.0.0/10")):
        return "Headscale addresses must be inside Tailscale's 100.64.0.0/10 range."
    return None


def _validate_hostname(value: str) -> str | None:
    if re.match(
        r"^[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?)+$",
        value,
    ):
        return None
    return "Enter a valid hostname (e.g. homelab.home.arpa)."


def _traefik_ip_for_subnet(subnet: str) -> str:
    network = ipaddress.IPv4Network(subnet)
    return str(network.network_address + 100)


def _ensure_docker_network(env: dict) -> None:
    from setup.utils import run_cmd

    subnet = env.get("DOCKER_SUBNET") or "10.10.30.0/24"
    current = run_cmd(
        [
            "docker",
            "network",
            "inspect",
            "homelab-net",
            "--format",
            "{{(index .IPAM.Config 0).Subnet}}",
        ],
        shell=False,
        check=False,
    )
    if current:
        if current != subnet:
            raise RuntimeError(
                f"homelab-net already uses {current}, but DOCKER_SUBNET={subnet}. "
                "Stop the stack and recreate that Docker network before changing subnets."
            )
        return
    run_cmd(
        ["docker", "network", "create", "homelab-net", "--subnet", subnet],
        shell=False,
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Homelab setup / backup / restore / reset")
    parser.add_argument(
        "command",
        nargs="?",
        default="setup",
        choices=["setup", "backup", "restore", "reset", "restart"],
        help="Mode to run (default: setup)",
    )
    parser.add_argument(
        "--auto",
        action="store_true",
        help="Non-interactive backup mode (used by systemd timer)",
    )
    parser.add_argument(
        "snapshot",
        nargs="?",
        default="latest",
        help="Restic snapshot id for restore (default: latest)",
    )
    return parser.parse_args()


def do_reset() -> None:
    from setup.service import remove_path, run_all_reset
    from setup.registry import get_services

    banner(
        "Homelab reset",
        "=============",
        "",
        "⚠️  This permanently destroys local homelab state:",
        "  - Stop/remove all Compose containers",
        "  - Delete ./services/*/volumes",
        "  - Delete .env and ./volumes (secrets & certificates)",
        "",
        "Type RESET to confirm.",
    )

    try:
        confirmation = input("Confirmation: ").strip()
        if confirmation != "RESET":
            error("Reset aborted.")
            sys.exit(0)

        section("Stopping containers…", emoji="🔥")
        subprocess.run(
            ["docker", "compose", "down", "-v", "--remove-orphans"],
            check=False,
        )

        env: dict = {}
        if os.path.exists(".env"):
            from setup.utils import load_env

            env = load_env(".env")

        section("Removing service volumes…", emoji="🧹")
        run_all_reset(get_services(), env)

        section("Removing shared state…", emoji="🧹")
        for path in (".env", "./volumes"):
            if remove_path(path):
                ok(f"Removed {path}")

        ok("Reset complete.")
        sys.exit(0)
    except KeyboardInterrupt:
        error("Reset aborted.")
        sys.exit(1)


def check_prereqs(extra: list[str] | None = None) -> None:
    section("Prerequisites", emoji="🔍")
    required = ["openssl", "argon2", "docker", "jq"]
    if extra:
        required.extend(extra)
    missing = [p for p in required if not shutil.which(p)]
    if missing:
        error(f"Missing: {', '.join(missing)}")
        sys.exit(1)
    ok("OK")


def _username_for_puid(puid: str) -> str | None:
    """Resolve OS login name for a numeric PUID (systemd User= may be numeric)."""
    import pwd

    try:
        return pwd.getpwuid(int(puid)).pw_name
    except (KeyError, ValueError, OverflowError, TypeError):
        return None


def _host_user_group() -> tuple[str, str]:
    """User/group when PUID cannot be resolved (e.g. sudo session)."""
    import grp
    import pwd

    sudo_user = os.environ.get("SUDO_USER")
    if os.geteuid() == 0 and sudo_user:
        pw = pwd.getpwnam(sudo_user)
    else:
        pw = pwd.getpwuid(os.getuid())
    return pw.pw_name, grp.getgrgid(pw.pw_gid).gr_name


def ensure_systemd_services() -> None:
    """Render systemd unit templates from .env, install, and enable host services."""
    import shlex
    import tempfile

    from setup.utils import load_env, prompt_yes_no, run_cmd, substitute_env_vars

    section("Systemd", emoji="⚙️")
    if not prompt_yes_no(
        "Install host units (host-api, backup timer, docker, timesyncd)? [Y/n]: ",
        default=True,
    ):
        skip("Skipped")
        return

    project_root = os.path.abspath(os.getcwd())
    units_src = os.path.join(project_root, "systemd", "system")
    if not os.path.isdir(units_src):
        warn(f"Missing {units_src}; skipping")
        return

    # Prefer the setup-generated .env (same substitution model as .env.template).
    if os.path.isfile(".env"):
        load_env(".env")
    os.environ["PROJECT_ROOT"] = os.environ.get("PROJECT_ROOT") or project_root
    os.environ["PROJECT_ROOT"] = os.path.abspath(os.environ["PROJECT_ROOT"])
    os.environ.setdefault("PUID", str(os.getuid()))
    os.environ.setdefault("PGID", str(os.getgid()))
    os.environ["PYTHON"] = sys.executable or "/usr/bin/python3"

    for name in sorted(os.listdir(units_src)):
        if not name.endswith((".service", ".timer")):
            continue
        src = os.path.join(units_src, name)
        with open(src, encoding="utf-8") as f:
            content = substitute_env_vars(f.read())
        if "${" in content or "$PUID" in content or "$PROJECT_ROOT" in content:
            error(f"Unsubstituted variables in {name}")
            step("Ensure .env defines PROJECT_ROOT, PUID, and PGID.")
            sys.exit(1)
        dest = f"/etc/systemd/system/{name}"
        with tempfile.NamedTemporaryFile("w", encoding="utf-8", delete=False, suffix=f"-{name}") as tmp:
            tmp.write(content)
            tmp_path = tmp.name
        try:
            run_cmd(f"sudo cp {shlex.quote(tmp_path)} {shlex.quote(dest)}")
            run_cmd(f"sudo chmod 644 {shlex.quote(dest)}")
        finally:
            os.unlink(tmp_path)

    host_api = os.path.join(os.environ["PROJECT_ROOT"], "services", "dashboard", "host-api")
    if not shutil.which("npm"):
        error("npm is required for the host API (install Node.js / npm)")
        sys.exit(1)
    step(f"npm install → {host_api}")
    run_cmd("npm install", cwd=host_api, capture=False)

    run_cmd("sudo systemctl daemon-reload")

    # Docker Desktop / WSL often has no docker.socket unit; docker may already be available.
    if run_cmd("sudo systemctl enable --now docker.socket docker.service", check=False) is None:
        skip("docker.socket/docker.service (common on WSL / Docker Desktop)")
    elif not shutil.which("docker"):
        warn("docker.service enabled but `docker` not found on PATH")

    for unit in (
        "homelab-host-api.service",
        "homelab-backup.timer",
    ):
        run_cmd(f"sudo systemctl enable --now {unit}")

    if shutil.which("pacman"):
        run_cmd("sudo systemctl enable --now pacman-sync.timer")

    run_cmd("sudo systemctl restart homelab-host-api.service", check=False)
    run_cmd("sudo systemctl enable --now systemd-timesyncd.service", check=False)
    sync = run_cmd("timedatectl show -p NTPSynchronized --value", check=False) or ""
    if sync.strip() != "yes":
        warn("Clock not NTP-synchronized yet (check systemd-timesyncd)")

    user = _username_for_puid(os.environ["PUID"]) or _host_user_group()[0]
    added_docker_group = False
    if user != "root":
        groups = run_cmd(f"id -nG {user}", check=False) or ""
        if "docker" not in groups.split():
            step(f"Adding {user} to docker group")
            run_cmd(f"sudo usermod -aG docker {shlex.quote(user)}")
            added_docker_group = True

    ok("Host units installed")

    if added_docker_group and os.geteuid() != 0:
        setup_py = shlex.quote(os.path.abspath(__file__))
        py = shlex.quote(sys.executable)
        root = shlex.quote(project_root)
        section("Re-running setup with docker group…", emoji="🔄")
        os.execvp(
            "sg",
            ["sg", "docker", "-c", f"cd {root} && {py} {setup_py} setup"],
        )


def ensure_env_file() -> dict:
    from setup.env_schema import (
        SERVICE_URL_NAMES,
        sync_env_file,
        validate_service_name,
        write_env_template,
    )
    from setup.utils import (
        detect_homelab_locale,
        load_env,
        phone_region_from_tz,
        run_cmd,
        substitute_env_vars,
    )

    # Keep template aligned with schema (comment-free, ${VAR:-default}).
    write_env_template(".env.template")

    if os.path.exists(".env"):
        env = sync_env_file(".env")
        return load_env(".env") if not env else env

    section("Environment", emoji="📝")
    if not os.path.exists(".env.template"):
        error(".env.template not found")
        sys.exit(1)

    from setup.utils import prompt_nonempty, prompt_password, prompt_yes_no

    username = prompt_nonempty("Username: ")
    password = prompt_password(
        "Password (min 12): ",
        confirm=True,
        confirm_label="Confirm password: ",
        min_length=12,
    )

    ip_address = ""
    try:
        ip_address = run_cmd("ip route get 1 | awk '{print $7;exit}'")
    except Exception:
        pass
    if not ip_address:
        ip_address = "127.0.0.1"

    puid = str(os.getuid() if hasattr(os, "getuid") else 1000)
    pgid = str(os.getgid() if hasattr(os, "getgid") else 1000)

    tz = "UTC"
    if shutil.which("timedatectl"):
        try:
            tz = run_cmd("timedatectl | grep 'Time zone' | awk '{print $3}'") or "UTC"
        except Exception:
            pass

    has_public = prompt_yes_no(
        "Public domain with Cloudflare DNS (Let's Encrypt)? [y/N]: ",
        default=False,
    )

    if has_public:
        hostname = prompt_nonempty(
            "Homelab hostname: ",
            validate=_validate_hostname,
        )
    else:
        hostname = prompt_nonempty(
            "Homelab hostname [homelab.home.arpa]: ",
            default="homelab.home.arpa",
            validate=_validate_hostname,
        )

    if prompt_yes_no("Separate VPN (Headscale) hostname? [Y/n]: ", default=True):
        headscale_web_hostname = prompt_nonempty(
            "VPN hostname: ",
            validate=_validate_hostname,
        )
    else:
        headscale_web_hostname = f"vpn.{hostname}"

    dns_domain = hostname.split(".", 1)[1] if "." in hostname else hostname

    lan_subnet = prompt_nonempty(
        "LAN subnet [10.10.10.0/24]: ",
        default="10.10.10.0/24",
        validate=_validate_ipv4_cidr,
    )
    docker_subnet = prompt_nonempty(
        "Docker subnet [10.10.30.0/24]: ",
        default="10.10.30.0/24",
        validate=_validate_docker_subnet,
    )
    headscale_prefix = prompt_nonempty(
        "Headscale VPN prefix [100.64.0.0/24]: ",
        default="100.64.0.0/24",
        validate=_validate_headscale_prefix,
    )

    os.makedirs("./volumes/secrets", exist_ok=True)
    os.chmod("./volumes/secrets", 0o700)

    with open("./volumes/secrets/homelab_password", "w", encoding="utf-8") as f:
        f.write(password)
    os.chmod("./volumes/secrets/homelab_password", 0o600)

    with open(".env.template", encoding="utf-8") as f:
        content = f.read()

    if has_public:
        cf_token = prompt_nonempty(
            "Cloudflare DNS API token (Zone:Read, DNS:Edit): "
        )
        acme_email = prompt_nonempty(
            "ACME email: ",
            validate=lambda e: (
                None
                if re.match(r"^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$", e)
                else "Enter a valid email address."
            ),
        )

        with open("./volumes/secrets/cf_dns_api_token", "w", encoding="utf-8") as f:
            f.write(cf_token)
        os.chmod("./volumes/secrets/cf_dns_api_token", 0o600)

        os.environ["TRAEFIK_CERT_RESOLVER"] = "letsencrypt"
        os.environ["ACME_EMAIL"] = acme_email
    else:
        os.environ["TRAEFIK_CERT_RESOLVER"] = ""
        os.environ["ACME_EMAIL"] = f"{username}@{hostname}"

    os.environ["HOMELAB_USERNAME"] = username
    os.environ["HOMELAB_EMAIL"] = f"{username}@{hostname}"
    os.environ["HOMELAB_IP_ADDRESS"] = ip_address
    os.environ["PUID"] = puid
    os.environ["PGID"] = pgid
    os.environ["HOMELAB_HOSTNAME"] = hostname
    os.environ["DNS_DOMAIN"] = dns_domain
    os.environ["PROJECT_ROOT"] = os.getcwd()
    os.environ["TZ"] = tz

    language, locale = detect_homelab_locale(tz, region=phone_region_from_tz(tz))
    os.environ["HOMELAB_LANGUAGE"] = language
    os.environ["HOMELAB_LOCALE"] = locale

    for key, default, _label in SERVICE_URL_NAMES:
        os.environ[key] = default
    if prompt_yes_no("Customize service URL names? [y/N]: ", default=False):
        for key, default, label in SERVICE_URL_NAMES:
            os.environ[key] = prompt_nonempty(
                f"{label} [{default}]: ",
                default=default,
                validate=validate_service_name,
            )

    os.environ["HOMELAB_DEFAULT_QUOTA_GB"] = os.environ.get("HOMELAB_DEFAULT_QUOTA_GB") or "50"
    os.environ["HEADSCALE_WEB_HOSTNAME"] = headscale_web_hostname
    os.environ["HEADSCALE_BASE_DOMAIN"] = f"ts.{dns_domain}"
    os.environ["LAN_SUBNET"] = lan_subnet
    os.environ["DOCKER_SUBNET"] = docker_subnet
    os.environ["TRAEFIK_IP_ADDRESS"] = _traefik_ip_for_subnet(docker_subnet)
    os.environ["HEADSCALE_IPV4_PREFIX"] = headscale_prefix
    from setup.utils import detect_host_api_url

    os.environ["HOST_API_URL"] = detect_host_api_url()

    content = substitute_env_vars(content)
    with open(".env", "w", encoding="utf-8") as f:
        f.write(content)

    env = sync_env_file(".env")
    mode = "Let's Encrypt" if has_public else "private CA"
    ok(f".env created ({mode})")
    return env


def ensure_bootstrap_and_locale(env: dict) -> dict:
    """Shared bootstrap only; per-service secrets are created in Service.setup()."""
    from setup.env_schema import sync_env_file
    from setup.utils import detect_homelab_locale, detect_host_api_url, phone_region_from_tz

    os.makedirs("./volumes/secrets", exist_ok=True)
    os.chmod("./volumes/secrets", 0o700)

    docker_subnet = env.get("DOCKER_SUBNET") or "10.10.30.0/24"
    updates: dict[str, str] = {}
    if not env.get("PROJECT_ROOT"):
        updates["PROJECT_ROOT"] = os.getcwd()
    if not env.get("HEADSCALE_BASE_DOMAIN"):
        updates["HEADSCALE_BASE_DOMAIN"] = f"ts.{env.get('DNS_DOMAIN') or 'home.arpa'}"
    if not env.get("TRAEFIK_IP_ADDRESS"):
        updates["TRAEFIK_IP_ADDRESS"] = _traefik_ip_for_subnet(docker_subnet)
    if not env.get("HOST_API_URL"):
        updates["HOST_API_URL"] = detect_host_api_url()
    if not env.get("HOMELAB_LANGUAGE") or not env.get("HOMELAB_LOCALE"):
        tz = env.get("TZ") or os.environ.get("TZ") or "UTC"
        language, locale = detect_homelab_locale(tz, region=phone_region_from_tz(tz))
        if not env.get("HOMELAB_LANGUAGE"):
            updates["HOMELAB_LANGUAGE"] = language
        if not env.get("HOMELAB_LOCALE"):
            updates["HOMELAB_LOCALE"] = locale

    env = sync_env_file(".env", updates=updates or None)

    if not os.path.exists("./volumes/secrets/homelab_password") or os.path.getsize(
        "./volumes/secrets/homelab_password"
    ) == 0:
        warn("homelab_password missing under volumes/secrets/")
        from setup.utils import prompt_password

        password = prompt_password(
            "Homelab password (min 12): ",
            min_length=12,
        )
        with open("./volumes/secrets/homelab_password", "w", encoding="utf-8") as f:
            f.write(password)
        os.chmod("./volumes/secrets/homelab_password", 0o600)

    return env


def ensure_certificates(env: dict) -> None:
    from setup.utils import run_cmd

    hostname = env.get("HOMELAB_HOSTNAME", "homelab.home.arpa")
    cert_resolver = env.get("TRAEFIK_CERT_RESOLVER", "")

    section("Certificates", emoji="🔐")
    certs_dir = "./volumes/certificates"
    os.makedirs(certs_dir, exist_ok=True)

    ca_key = f"{certs_dir}/homelab-ca.key"
    ca_cert = f"{certs_dir}/homelab-ca.crt"
    server_key = f"{certs_dir}/{hostname}.key"
    server_cert = f"{certs_dir}/{hostname}.crt"
    fallback_key = f"{certs_dir}/homelab.key"
    fallback_cert = f"{certs_dir}/homelab.crt"

    # Always mint a local CA + wildcard server cert. Private mode serves these as the
    # primary TLS. Let's Encrypt mode still needs valid PEM here for Traefik's
    # defaultCertificate fallback (and for services that mount the CA).
    if not os.path.exists(ca_key) or not os.path.exists(ca_cert):
        step("Generating local CA…")
        run_cmd(f"openssl genrsa -out {ca_key} 4096")
        run_cmd(
            f'openssl req -x509 -new -nodes -key {ca_key} -sha256 -days 3650 '
            f'-out {ca_cert} -subj "/CN=Homelab Root CA/O=Homelab/C=US"'
        )

    if not os.path.exists(server_key) or not os.path.exists(server_cert):
        step(f"Generating certificate for *.{hostname}…")
        conf_file = "/tmp/server_ssl_config.cnf"
        csr_file = f"/tmp/{hostname}.csr"
        config_content = f"""[req]
default_bits = 4096
distinguished_name = req_distinguished_name
req_extensions = v3_req
prompt = no

[req_distinguished_name]
C = US
O = Homelab
CN = *.{hostname}

[v3_req]
keyUsage = digitalSignature, keyEncipherment, dataEncipherment
extendedKeyUsage = serverAuth
subjectAltName = @alt_names

[alt_names]
DNS.1 = {hostname}
DNS.2 = *.{hostname}
DNS.3 = *.home.arpa
"""
        with open(conf_file, "w", encoding="utf-8") as f:
            f.write(config_content)

        run_cmd(f"openssl req -new -nodes -out {csr_file} -keyout {server_key} -config {conf_file}")
        run_cmd(
            f"openssl x509 -req -in {csr_file} -CA {ca_cert} -CAkey {ca_key} -CAcreateserial "
            f"-out {server_cert} -days 3650 -sha256 -extfile {conf_file} -extensions v3_req"
        )

        if os.path.exists(conf_file):
            os.remove(conf_file)
        if os.path.exists(csr_file):
            os.remove(csr_file)

    # Traefik defaultCertificate paths (stable names, independent of hostname)
    if (
        not os.path.exists(fallback_cert)
        or not os.path.exists(fallback_key)
        or os.path.getsize(fallback_cert) == 0
        or os.path.getsize(fallback_key) == 0
    ):
        shutil.copy(server_cert, fallback_cert)
        shutil.copy(server_key, fallback_key)

    # Localhost-only default used when Let's Encrypt is enabled (must not match
    # production SNI or Homelab CA shadows ACME).
    default_cert = f"{certs_dir}/traefik-default.crt"
    default_key = f"{certs_dir}/traefik-default.key"
    if not os.path.exists(default_cert) or not os.path.exists(default_key):
        conf_file = "/tmp/traefik_default_ssl.cnf"
        csr_file = "/tmp/traefik-default.csr"
        with open(conf_file, "w", encoding="utf-8") as f:
            f.write(
                """[req]
default_bits = 2048
distinguished_name = req_distinguished_name
req_extensions = v3_req
prompt = no

[req_distinguished_name]
C = US
O = Homelab
CN = traefik-default

[v3_req]
keyUsage = digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
IP.1 = 127.0.0.1
"""
            )
        run_cmd(f"openssl req -new -nodes -out {csr_file} -keyout {default_key} -config {conf_file}")
        run_cmd(
            f"openssl x509 -req -in {csr_file} -CA {ca_cert} -CAkey {ca_key} -CAcreateserial "
            f"-out {default_cert} -days 3650 -sha256 -extfile {conf_file} -extensions v3_req"
        )
        for path in (conf_file, csr_file):
            if os.path.exists(path):
                os.remove(path)

    if os.path.exists(ca_cert):
        if os.path.exists("/etc/ca-certificates/trust-source/anchors") and shutil.which("trust"):
            run_cmd(
                f"sudo cp {ca_cert} /etc/ca-certificates/trust-source/anchors/ && "
                "sudo trust extract-compat >/dev/null 2>&1 || true"
            )
        elif shutil.which("update-ca-certificates"):
            dest = f"/usr/local/share/ca-certificates/{os.path.basename(ca_cert)}"
            run_cmd(f"sudo cp {ca_cert} {dest} && sudo update-ca-certificates >/dev/null 2>&1 || true")
        elif os.path.exists("/etc/pki/ca-trust/source/anchors") and shutil.which("update-ca-trust"):
            run_cmd(
                f"sudo cp {ca_cert} /etc/pki/ca-trust/source/anchors/ && "
                "sudo update-ca-trust extract >/dev/null 2>&1 || true"
            )

    # Select Traefik defaultCertificate: private → Homelab wildcard; LE → localhost-only.
    os.makedirs("./services/traefik/volumes", exist_ok=True)
    tls_src = (
        "./services/traefik/tls.letsencrypt.yml"
        if cert_resolver == "letsencrypt"
        else "./services/traefik/tls.private.yml"
    )
    tls_dst = "./services/traefik/volumes/tls.yml"
    shutil.copy(tls_src, tls_dst)
    ok("Ready")


def run_setup() -> None:
    from setup.service import run_all_postsetup, run_all_setup
    from setup.registry import get_services
    from setup.utils import compose_up, run_cmd, wait_for_containers

    banner("Homelab setup", "=============")
    check_prereqs()

    env = ensure_env_file()
    ensure_systemd_services()
    hostname = env.get("HOMELAB_HOSTNAME", "homelab.home.arpa")
    cert_resolver = env.get("TRAEFIK_CERT_RESOLVER", "")
    env = ensure_bootstrap_and_locale(env)
    ensure_certificates(env)

    os.environ.setdefault("PROJECT_ROOT", os.getcwd())

    services = get_services()
    section("Service setup", emoji="📁")
    run_all_setup(services, env)

    # Reload secrets written by services so postsetup / compose-adjacent tools see them
    from setup.utils import ensure_secrets_container_access, load_secrets

    ensure_secrets_container_access()
    load_secrets()

    _ensure_docker_network(env)

    section("Building containers…", emoji="🔨")
    run_cmd("docker compose build", capture=False)

    section("Starting containers…", emoji="🐳")
    from setup.utils import ensure_secrets_container_access

    compose_up()

    # authentik-ldap needs the Outpost token written in authentik postsetup.
    wait_for_containers(exclude={"authentik-ldap"})

    section("Service postsetup", emoji="⚙️")
    run_all_postsetup(services, env)

    # Postsetup may rewrite secrets (e.g. notification tokens); refresh ACLs.
    ensure_secrets_container_access()

    wait_for_containers(timeout=180)

    banner("Setup complete", "==============")
    user = env.get("HOMELAB_USERNAME")
    print(f"  User:  {user}")
    print(f"  Email: {user}@{hostname}")
    print(f"  URL:   https://{env.get('DASHBOARD_SERVICE_NAME')}.{hostname}")
    if cert_resolver != "letsencrypt":
        warn("Trust the CA on your devices: ./volumes/certificates/homelab-ca.crt")


def run_backup(auto: bool = False) -> None:
    from setup.restic_backup import restic_backup
    from setup.service import run_all_backup
    from setup.registry import get_services
    from setup.utils import load_env, load_secrets

    banner("Homelab backup", "==============")
    check_prereqs(extra=["restic"])

    if not os.path.exists(".env"):
        error(".env not found. Run setup first.")
        sys.exit(1)

    env = load_env(".env")
    env = ensure_bootstrap_and_locale(env)
    load_secrets()
    os.environ.setdefault("PROJECT_ROOT", os.getcwd())

    services = get_services()
    section("Service backup hooks", emoji="💾")
    run_all_backup(services, env)

    restic_backup(auto=auto)


def run_restore(snapshot: str = "latest") -> None:
    from setup.restic_backup import restic_restore
    from setup.service import run_all_postsetup, run_all_restore, run_all_setup
    from setup.registry import get_services
    from setup.utils import compose_up, load_env, load_secrets, wait_for_containers

    banner("Homelab restore", "===============")
    check_prereqs(extra=["restic"])

    warn("This overwrites local .env / volumes from the Restic snapshot.")
    from setup.utils import prompt_yes_no

    if not prompt_yes_no("Proceed? [y/N]: ", default=False):
        error("Restore aborted.")
        sys.exit(0)

    restic_restore(snapshot)

    if not os.path.exists(".env"):
        error(".env missing after restore.")
        sys.exit(1)

    env = load_env(".env")
    load_secrets()
    os.environ.setdefault("PROJECT_ROOT", os.getcwd())

    services = get_services()
    section("Service setup", emoji="📁")
    run_all_setup(services, env)

    _ensure_docker_network(env)
    section("Starting containers…", emoji="🐳")
    compose_up()

    # Apply dumps before waiting on healthchecks. Live Postgres dirs are
    # restic-excluded; apps may be unhealthy until restore() runs.
    section("Service restore hooks", emoji="♻️")
    run_all_restore(services, env)

    wait_for_containers(exclude={"authentik-ldap"})
    section("Service postsetup", emoji="⚙️")
    run_all_postsetup(services, env)
    wait_for_containers(timeout=180)

    ok("Restore complete.")


def run_restart() -> None:
    from setup.utils import compose_up, load_env, load_secrets, wait_for_containers
    import subprocess

    banner("Homelab restart", "===============")

    if not os.path.exists(".env"):
        error(".env not found. Run setup first.")
        sys.exit(1)

    env = load_env(".env")
    load_secrets()
    os.environ.setdefault("PROJECT_ROOT", os.getcwd())

    section("Stopping containers…", emoji="🐳")
    subprocess.run(["docker", "compose", "down", "--remove-orphans"], check=True)

    section("Starting containers…", emoji="🐳")
    compose_up()

    wait_for_containers(timeout=120)
    ok("Restart complete.")


def main() -> None:
    args = parse_args()

    if args.command == "setup":
        run_setup()
    elif args.command == "backup":
        run_backup(auto=args.auto)
    elif args.command == "restore":
        run_restore(args.snapshot or "latest")
    elif args.command == "reset":
        do_reset()
    elif args.command == "restart":
        run_restart()
    else:
        print(f"Unknown command: {args.command}")
        sys.exit(1)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\033[93mCancelled.\033[0m")
        sys.exit(130)
