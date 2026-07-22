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

from setup.ui import banner, error, info, ok, section, skip, step, warn


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
        choices=["setup", "backup", "restore", "reset", "restart", "sync-accounts"],
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
        "🏠 Homelab Reset Utility",
        "========================",
        "",
        "⚠️  WARNING: This will permanently destroy your entire homelab state:",
        "   - Stop and remove all Docker containers",
        "   - Run each service's reset() (typically ./{service}/volumes)",
        "   - Delete shared state (.env, volumes/ secrets & certificates)",
        "",
        "🚨 THIS ACTION IS IRREVERSIBLE!",
    )

    try:
        from setup.utils import prompt_yes_no

        if not prompt_yes_no(
            "\nAre you absolutely sure you want to reset your homelab? (y/N): ",
            default=False,
        ):
            error("Reset aborted.")
            sys.exit(0)

        section("Resetting homelab stack...", emoji="🔥")
        subprocess.run("docker compose down -v", shell=True, check=False)

        env: dict = {}
        if os.path.exists(".env"):
            from setup.utils import load_env

            env = load_env(".env")

        section("Running per-service reset()...", emoji="🧹")
        run_all_reset(get_services(), env)

        section("Removing shared host state...", emoji="🧹")
        for path in (".env", "./volumes"):
            if remove_path(path):
                ok(f"Removed {path}")

        ok("Homelab has been successfully reset.")
        sys.exit(0)
    except KeyboardInterrupt:
        error("Reset aborted.")
        sys.exit(1)


def check_prereqs(extra: list[str] | None = None) -> None:
    section("Checking prerequisites...", emoji="🔍")
    required = ["openssl", "argon2", "docker", "jq"]
    if extra:
        required.extend(extra)
    missing = [p for p in required if not shutil.which(p)]
    if missing:
        error(f"Missing required programs: {', '.join(missing)}")
        step("Please install them and try again.")
        sys.exit(1)
    ok("All prerequisites found")


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

    section("Configuring systemd host services...", emoji="⚙️")
    if not prompt_yes_no(
        "   Install/enable systemd units (host-api, backup timer, docker, timesyncd)? [Y/n]: ",
        default=True,
    ):
        skip("Skipping systemd host services (dev / manual manage)")
        return

    project_root = os.path.abspath(os.getcwd())
    units_src = os.path.join(project_root, "systemd", "system")
    if not os.path.isdir(units_src):
        warn(f"Missing {units_src}; skipping systemd install")
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
            error(f"Unsubstituted variables remain in {name} after env expand")
            step("Ensure .env defines PROJECT_ROOT, PUID, and PGID.")
            sys.exit(1)
        dest = f"/etc/systemd/system/{name}"
        step(f"Installing {dest}")
        with tempfile.NamedTemporaryFile("w", encoding="utf-8", delete=False, suffix=f"-{name}") as tmp:
            tmp.write(content)
            tmp_path = tmp.name
        try:
            run_cmd(f"sudo cp {shlex.quote(tmp_path)} {shlex.quote(dest)}")
            run_cmd(f"sudo chmod 644 {shlex.quote(dest)}")
        finally:
            os.unlink(tmp_path)

    host_api = os.path.join(os.environ["PROJECT_ROOT"], "dashboard", "host-api")
    if not shutil.which("npm"):
        error("npm is required for the host API (install Node.js / npm)")
        sys.exit(1)
    step(f"npm install in {host_api}")
    run_cmd("npm install", cwd=host_api, capture=False)

    run_cmd("sudo systemctl daemon-reload")

    step("Enabling docker…")
    run_cmd("sudo systemctl enable --now docker.socket docker.service")

    for unit in (
        "homelab-host-api.service",
        "homelab-backup.timer",
    ):
        step(f"Enabling {unit}…")
        run_cmd(f"sudo systemctl enable --now {unit}")

    if shutil.which("pacman"):
        step("Enabling pacman-sync.timer…")
        run_cmd("sudo systemctl enable --now pacman-sync.timer")
    else:
        info("pacman not found; skipping pacman-sync.timer")

    run_cmd("sudo systemctl restart homelab-host-api.service", check=False)

    step("Enabling systemd-timesyncd…")
    run_cmd("sudo systemctl enable --now systemd-timesyncd.service", check=False)
    sync = run_cmd("timedatectl show -p NTPSynchronized --value", check=False) or ""
    if sync.strip() == "yes":
        ok("System clock is NTP-synchronized")
    else:
        warn("System clock not yet NTP-synchronized")
        step("If this persists, see ./systemd/timesyncd.conf and restart systemd-timesyncd")

    user = _username_for_puid(os.environ["PUID"]) or _host_user_group()[0]
    added_docker_group = False
    if user != "root":
        groups = run_cmd(f"id -nG {user}", check=False) or ""
        if "docker" not in groups.split():
            step(f"Adding {user} to the docker group…")
            run_cmd(f"sudo usermod -aG docker {shlex.quote(user)}")
            added_docker_group = True

    ok("Systemd host services configured")

    if added_docker_group and os.geteuid() != 0:
        setup_py = shlex.quote(os.path.abspath(__file__))
        py = shlex.quote(sys.executable)
        root = shlex.quote(project_root)
        section("Re-running setup under the docker group (new membership)…", emoji="🔄")
        os.execvp(
            "sg",
            ["sg", "docker", "-c", f"cd {root} && {py} {setup_py} setup"],
        )


def ensure_env_file() -> dict:
    from setup.utils import (
        detect_homelab_locale,
        load_env,
        phone_region_from_tz,
        run_cmd,
        substitute_env_vars,
    )

    if os.path.exists(".env"):
        ok("Environment configuration already exists")
        return load_env(".env")

    section("Generating environment configuration...", emoji="📝")
    if not os.path.exists(".env.template"):
        error("Template file .env.template not found")
        sys.exit(1)

    from setup.utils import prompt_nonempty, prompt_password, prompt_yes_no

    step("Enter username and password for homelab services:")
    username = prompt_nonempty("                       Username: ")
    password = prompt_password(
        "   Password (min 12 characters): ",
        confirm=True,
        confirm_label="   Confirm Password: ",
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

    print("\n   SSL Certificate Mode:")
    print("   Traefik supports two modes:")
    print("     • Public  (y) — Let's Encrypt via Cloudflare DNS-01; requires a public domain")
    print("     • Private (n) — Self-signed CA generated locally (no public domain needed)")
    has_public = prompt_yes_no(
        "   Do you have a public domain with Cloudflare DNS? (y/n): "
    )

    print("")
    headscale_web_hostname = ""
    if has_public:
        print("   Enter homelab hostname (public domain, e.g. homelab.your-domain.com):")
        hostname = prompt_nonempty(
            "              Homelab Hostname: ",
            validate=lambda h: (
                None
                if re.match(
                    r"^[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?)+$",
                    h,
                )
                else "That doesn't look like a valid hostname. Please try again."
            ),
        )
        print("\n   By default, VPN uses vpn.<homelab-hostname>.")
        print("   If your DNS is configured to point your main subdomains to local IPs,")
        print("   you can specify a separate public domain/hostname specifically for the VPN:")
        if prompt_yes_no(
            "   Configure a separate public domain for VPN? (Y/n): ",
            default=True
        ):
            headscale_web_hostname = prompt_nonempty(
                "              VPN Public Hostname: ",
                validate=lambda h: (
                    None
                    if re.match(
                        r"^[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?)+$",
                        h,
                    )
                    else "That doesn't look like a valid hostname. Please try again."
                ),
            )
        else:
            headscale_web_hostname = f"vpn.{hostname}"
    else:
        print("   Enter homelab hostname (private local domain, e.g. homelab.home.arpa):")
        hostname = prompt_nonempty(
            "              Homelab Hostname [homelab.home.arpa]: ",
            default="homelab.home.arpa",
            validate=lambda h: (
                None
                if re.match(
                    r"^[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?)+$",
                    h,
                )
                else "That doesn't look like a valid hostname. Please try again."
            ),
        )
        headscale_web_hostname = f"vpn.{hostname}"

    dns_domain = hostname.split(".", 1)[1] if "." in hostname else hostname

    print("\n   LAN subnet advertised to remote Tailscale clients (Headscale router):")
    lan_subnet = prompt_nonempty(
        "              LAN subnet [10.10.10.0/24]: ",
        default="10.10.10.0/24",
        validate=_validate_ipv4_cidr,
    )
    docker_subnet = prompt_nonempty(
        "           Docker subnet [10.10.30.0/24]: ",
        default="10.10.30.0/24",
        validate=_validate_docker_subnet,
    )
    headscale_prefix = prompt_nonempty(
        "   Headscale VPN prefix [100.64.0.0/24]: ",
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
            "   Cloudflare DNS API token (Zone.Zone:Read, Zone.DNS:Edit): "
        )

        print("\n   Let's Encrypt requires a valid e-mail address for certificate expiry notices.")
        acme_email = prompt_nonempty(
            "   ACME e-mail address: ",
            validate=lambda e: (
                None
                if re.match(r"^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$", e)
                else "That doesn't look like a valid e-mail address. Please try again."
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
    step(f"Detected locale: {language} / {locale} (from host LANG or TZ={tz})")

    os.environ["DASHBOARD_SERVICE_NAME"] = "dashboard"
    os.environ["PIHOLE_SERVICE_NAME"] = "dns"
    os.environ["DOCKHAND_SERVICE_NAME"] = "docker"
    os.environ["VAULTWARDEN_SERVICE_NAME"] = "vault"
    os.environ["GATUS_SERVICE_NAME"] = "status"
    os.environ["GOTIFY_SERVICE_NAME"] = "notify"
    os.environ["AUTHENTIK_SERVICE_NAME"] = "auth"
    os.environ["DAV_SERVICE_NAME"] = "dav"
    os.environ["HEADSCALE_SERVICE_NAME"] = "vpn"
    os.environ["ROUNDCUBE_SERVICE_NAME"] = "mail"
    os.environ["HEADSCALE_WEB_HOSTNAME"] = headscale_web_hostname
    os.environ["HEADSCALE_BASE_DOMAIN"] = f"ts.{dns_domain}"
    os.environ["LAN_SUBNET"] = lan_subnet
    os.environ["DOCKER_SUBNET"] = docker_subnet
    os.environ["TRAEFIK_IP_ADDRESS"] = _traefik_ip_for_subnet(docker_subnet)
    os.environ["HEADSCALE_IPV4_PREFIX"] = headscale_prefix

    content = substitute_env_vars(content)
    with open(".env", "w", encoding="utf-8") as f:
        f.write(content)

    env = load_env(".env")
    if has_public:
        ok("Let's Encrypt (Cloudflare DNS-01) mode configured")
    else:
        ok("Self-signed certificate mode configured")
    ok("Environment configuration created")
    return env


def ensure_bootstrap_and_locale(env: dict) -> dict:
    """Shared bootstrap only; per-service secrets are created in Service.setup()."""
    from setup.utils import append_env, detect_homelab_locale, phone_region_from_tz

    step("Ensuring shared bootstrap secrets...")
    os.makedirs("./volumes/secrets", exist_ok=True)
    os.chmod("./volumes/secrets", 0o700)

    docker_subnet = env.get("DOCKER_SUBNET") or "10.10.30.0/24"
    for key, default in (
        ("DAV_SERVICE_NAME", "dav"),
        ("HEADSCALE_SERVICE_NAME", "vpn"),
        ("ROUNDCUBE_SERVICE_NAME", "mail"),
        ("HEADSCALE_BASE_DOMAIN", f"ts.{env.get('DNS_DOMAIN') or 'home.arpa'}"),
        ("LAN_SUBNET", "10.10.10.0/24"),
        ("DOCKER_SUBNET", docker_subnet),
        ("TRAEFIK_IP_ADDRESS", _traefik_ip_for_subnet(docker_subnet)),
        ("HEADSCALE_IPV4_PREFIX", "100.64.0.0/24"),
    ):
        if not env.get(key):
            append_env(env, key, default)

    if not env.get("HOMELAB_LANGUAGE") or not env.get("HOMELAB_LOCALE"):
        tz = env.get("TZ") or os.environ.get("TZ") or "UTC"
        language, locale = detect_homelab_locale(tz, region=phone_region_from_tz(tz))
        with open(".env", "a", encoding="utf-8") as f:
            if not env.get("HOMELAB_LANGUAGE"):
                f.write(f"\nHOMELAB_LANGUAGE='{language}'\n")
                env["HOMELAB_LANGUAGE"] = language
                os.environ["HOMELAB_LANGUAGE"] = language
            if not env.get("HOMELAB_LOCALE"):
                f.write(f"\nHOMELAB_LOCALE='{locale}'\n")
                env["HOMELAB_LOCALE"] = locale
                os.environ["HOMELAB_LOCALE"] = locale
        step(f"Locale defaults: {env.get('HOMELAB_LANGUAGE')} / {env.get('HOMELAB_LOCALE')}")

    if not os.path.exists("./volumes/secrets/homelab_password") or os.path.getsize(
        "./volumes/secrets/homelab_password"
    ) == 0:
        warn("homelab_password secret is missing from volumes/secrets!")
        from setup.utils import prompt_password

        password = prompt_password(
            "   Please re-enter your homelab Password (min 12 characters): ",
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

    section("Setting up certificates and keys...", emoji="🔐")
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
    if cert_resolver == "letsencrypt":
        step("Let's Encrypt is enabled; also ensuring local CA/fallback certs exist…")

    if not os.path.exists(ca_key) or not os.path.exists(ca_cert):
        step("Generating local Certificate Authority (CA)...")
        run_cmd(f"openssl genrsa -out {ca_key} 4096")
        run_cmd(
            f'openssl req -x509 -new -nodes -key {ca_key} -sha256 -days 3650 '
            f'-out {ca_cert} -subj "/CN=Homelab Root CA/O=Homelab/C=US"'
        )
        ok("CA certificate and key generated")

    if not os.path.exists(server_key) or not os.path.exists(server_cert):
        step(f"Generating server certificate for {hostname}...")
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
        ok("Server certificate generated")

    # Traefik defaultCertificate paths (stable names, independent of hostname)
    if (
        not os.path.exists(fallback_cert)
        or not os.path.exists(fallback_key)
        or os.path.getsize(fallback_cert) == 0
        or os.path.getsize(fallback_key) == 0
    ):
        shutil.copy(server_cert, fallback_cert)
        shutil.copy(server_key, fallback_key)
        ok("Traefik fallback homelab.crt / homelab.key ready")

    # Localhost-only default used when Let's Encrypt is enabled (must not match
    # production SNI or Homelab CA shadows ACME).
    default_cert = f"{certs_dir}/traefik-default.crt"
    default_key = f"{certs_dir}/traefik-default.key"
    if not os.path.exists(default_cert) or not os.path.exists(default_key):
        step("Generating Traefik localhost-only default certificate…")
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
        step("Trusting CA certificate locally...")
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
    os.makedirs("./traefik/volumes", exist_ok=True)
    tls_src = (
        "./traefik/tls.letsencrypt.yml"
        if cert_resolver == "letsencrypt"
        else "./traefik/tls.private.yml"
    )
    tls_dst = "./traefik/volumes/tls.yml"
    shutil.copy(tls_src, tls_dst)
    ok(f"Traefik TLS config: {tls_src} → {tls_dst}")
    ok("SSL certificates ready")


def run_setup() -> None:
    from setup.service import run_all_postsetup, run_all_setup
    from setup.registry import get_services
    from setup.utils import compose_up, run_cmd, wait_for_containers

    banner("🏠 Homelab Python Setup Script", "==============================")
    check_prereqs()

    env = ensure_env_file()
    ensure_systemd_services()
    hostname = env.get("HOMELAB_HOSTNAME", "homelab.home.arpa")
    cert_resolver = env.get("TRAEFIK_CERT_RESOLVER", "")
    env = ensure_bootstrap_and_locale(env)
    ensure_certificates(env)

    os.environ.setdefault("PROJECT_ROOT", os.getcwd())

    services = get_services()
    section("Running per-service setup()...", emoji="📁")
    run_all_setup(services, env)

    # Reload secrets written by services so postsetup / compose-adjacent tools see them
    from setup.utils import ensure_secrets_container_access, load_secrets

    section("Ensuring secrets stay private but readable by containers...", emoji="🔐")
    ensure_secrets_container_access()
    load_secrets()

    _ensure_docker_network(env)

    section("Building Docker containers...", emoji="🔨")
    run_cmd("docker compose build", capture=False)

    section("Starting Docker containers...", emoji="🐳")
    compose_up()

    wait_for_containers()
    ok("Docker containers started")

    section("Running per-service postsetup()...", emoji="⚙️")
    run_all_postsetup(services, env)

    # Postsetup may rewrite secrets (e.g. notification tokens); refresh ACLs.
    ensure_secrets_container_access()

    wait_for_containers(timeout=120)
    ok("Postsetup containers healthy")

    banner("", "🎉 Homelab Setup Complete!", "==========================")
    print(
        f"📋 Access Information:\n   Username: {env.get('HOMELAB_USERNAME')}\n"
        f"   Email:    {env.get('HOMELAB_USERNAME')}@{hostname}"
    )
    print(f"\n🌐 Web Access:")
    print(f"   Dashboard:  https://{env.get('DASHBOARD_SERVICE_NAME')}.{hostname}")
    ssl_mode = "Self-signed (private)" if cert_resolver != "letsencrypt" else "Public (Let's Encrypt)"
    print(f"\n🔒 SSL Mode: {ssl_mode}")
    if cert_resolver != "letsencrypt":
        warn("Remember to add the CA certificate to your devices' trust stores!")
        step("CA Certificate: ./volumes/certificates/homelab-ca.crt")


def run_backup(auto: bool = False) -> None:
    from setup.restic_backup import restic_backup
    from setup.service import run_all_backup
    from setup.registry import get_services
    from setup.utils import load_env, load_secrets

    banner("🏠 Homelab Cloud Backup", "=======================")
    check_prereqs(extra=["restic"])

    if not os.path.exists(".env"):
        error(".env not found. Run setup first or restore from Restic.")
        sys.exit(1)

    env = load_env(".env")
    env = ensure_bootstrap_and_locale(env)
    load_secrets()
    os.environ.setdefault("PROJECT_ROOT", os.getcwd())

    if auto:
        step("--> Running in automatic mode.")

    services = get_services()
    section("Running per-service backup() hooks...", emoji="💾")
    run_all_backup(services, env)

    restic_backup(auto=auto)


def run_restore(snapshot: str = "latest") -> None:
    from setup.restic_backup import restic_restore
    from setup.service import run_all_postsetup, run_all_restore, run_all_setup
    from setup.registry import get_services
    from setup.utils import compose_up, load_env, load_secrets, wait_for_containers

    banner("🏠 Homelab Cloud Restore", "========================")
    check_prereqs(extra=["restic"])

    warn(
        "This will overwrite local gitignored state (.env, volumes/, */volumes/) "
        "from the Restic snapshot, then start containers and run restore hooks."
    )
    from setup.utils import prompt_yes_no

    if not prompt_yes_no("Proceed? [y/N]: ", default=False):
        step("Restore aborted.")
        sys.exit(0)

    restic_restore(snapshot)

    if not os.path.exists(".env"):
        error(".env missing after restore.")
        sys.exit(1)

    env = load_env(".env")
    load_secrets()
    os.environ.setdefault("PROJECT_ROOT", os.getcwd())

    services = get_services()
    section("Re-applying volume permissions via setup()...", emoji="📁")
    run_all_setup(services, env)

    _ensure_docker_network(env)
    section("Starting Docker containers...", emoji="🐳")
    compose_up()

    # Apply dumps before waiting on healthchecks. Live Postgres dirs are
    # restic-excluded; apps may be unhealthy until restore() runs.
    section("Running per-service restore() hooks...", emoji="♻️")
    run_all_restore(services, env)

    wait_for_containers()
    section("Running per-service postsetup()...", emoji="⚙️")
    run_all_postsetup(services, env)
    wait_for_containers(timeout=120)

    ok("Restore complete.")


def run_restart() -> None:
    from setup.utils import compose_up, load_env, load_secrets, wait_for_containers
    import subprocess

    banner("🔄 Homelab Full Restart", "=======================")

    if not os.path.exists(".env"):
        error(".env not found. Run setup first.")
        sys.exit(1)

    env = load_env(".env")
    load_secrets()
    os.environ.setdefault("PROJECT_ROOT", os.getcwd())

    section("Stopping and removing all containers...", emoji="🐳")
    subprocess.run(["docker", "compose", "down"], check=True)

    section("Starting all containers...", emoji="🐳")
    compose_up()

    wait_for_containers(timeout=120)
    ok("All containers restarted and healthy.")


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
    elif args.command == "sync-accounts":
        from setup.file_accounts import trigger_accounts_sync
        trigger_accounts_sync(recreate=True)
    else:
        print(f"Unknown command: {args.command}")
        sys.exit(1)


if __name__ == "__main__":
    main()
