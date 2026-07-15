#!/usr/bin/env python3
"""Homelab orchestration: setup, backup, and restore."""
from __future__ import annotations

import argparse
import os
import re
import shutil
import subprocess
import sys


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Homelab setup / backup / restore / reset")
    parser.add_argument(
        "command",
        nargs="?",
        default="setup",
        choices=["setup", "backup", "restore", "reset"],
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
    from service import remove_path, run_all_reset
    from services_registry import get_services

    print("🏠 Homelab Reset Utility")
    print("========================")
    print("\n⚠️  WARNING: This will permanently destroy your entire homelab state:")
    print("   - Stop and remove all Docker containers")
    print("   - Run each service's reset() (typically ./{service}/volumes)")
    print("   - Delete shared state (.env, volumes/ secrets & certificates)")
    print("\n🚨 THIS ACTION IS IRREVERSIBLE!")

    try:
        from setup_utils import prompt_yes_no

        if not prompt_yes_no(
            "\nAre you absolutely sure you want to reset your homelab? (y/N): ",
            default=False,
        ):
            print("\n❌ Reset aborted.")
            sys.exit(0)

        print("\n🔥 Resetting homelab stack...")
        subprocess.run("docker compose down -v", shell=True, check=False)

        env: dict = {}
        if os.path.exists(".env"):
            from setup_utils import load_env

            env = load_env(".env")

        print("\n🧹 Running per-service reset()...")
        run_all_reset(get_services(), env)

        print("\n🧹 Removing shared host state...")
        for path in (".env", "./volumes"):
            if remove_path(path):
                print(f"   ✅ Removed {path}")

        print("\n✅ Homelab has been successfully reset.")
        sys.exit(0)
    except KeyboardInterrupt:
        print("\n❌ Reset aborted.")
        sys.exit(1)


def check_prereqs(extra: list[str] | None = None) -> None:
    print("🔍 Checking prerequisites...")
    required = ["openssl", "argon2", "docker", "jq"]
    if extra:
        required.extend(extra)
    missing = [p for p in required if not shutil.which(p)]
    if missing:
        print(f"❌ Missing required programs: {', '.join(missing)}")
        print("   Please install them and try again.")
        sys.exit(1)
    print("✅ All prerequisites found")


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

    from setup_utils import load_env, prompt_yes_no, run_cmd, substitute_env_vars

    print("\n⚙️  Configuring systemd host services...")
    if not prompt_yes_no(
        "   Install/enable systemd units (host-api, backup timer, docker, timesyncd)? [Y/n]: ",
        default=True,
    ):
        print("   ⏭️  Skipping systemd host services (dev / manual manage)")
        return

    project_root = os.path.abspath(os.getcwd())
    units_src = os.path.join(project_root, "systemd", "system")
    if not os.path.isdir(units_src):
        print(f"   ⚠️  Missing {units_src}; skipping systemd install")
        return

    # Prefer the setup-generated .env (same substitution model as .env.template).
    if os.path.isfile(".env"):
        load_env(".env")
    os.environ["PROJECT_ROOT"] = os.environ.get("PROJECT_ROOT") or project_root
    os.environ["PROJECT_ROOT"] = os.path.abspath(os.environ["PROJECT_ROOT"])
    os.environ.setdefault("PUID", str(os.getuid()))
    os.environ.setdefault("PGID", str(os.getgid()))
    os.environ["NODE"] = shutil.which("node") or "/usr/bin/node"
    os.environ["PYTHON"] = sys.executable or "/usr/bin/python3"

    for name in sorted(os.listdir(units_src)):
        if not name.endswith((".service", ".timer")):
            continue
        src = os.path.join(units_src, name)
        with open(src, encoding="utf-8") as f:
            content = substitute_env_vars(f.read())
        if "${" in content or "$PUID" in content or "$PROJECT_ROOT" in content:
            print(f"❌ Unsubstituted variables remain in {name} after env expand")
            print("   Ensure .env defines PROJECT_ROOT, PUID, and PGID.")
            sys.exit(1)
        dest = f"/etc/systemd/system/{name}"
        print(f"   Installing {dest}")
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
        print("❌ npm is required for the host API (install Node.js / npm)")
        sys.exit(1)
    print(f"   npm install in {host_api}")
    run_cmd("npm install", cwd=host_api, capture=False)

    run_cmd("sudo systemctl daemon-reload")

    print("   Enabling docker…")
    run_cmd("sudo systemctl enable --now docker.socket docker.service")

    for unit in (
        "homelab-host-api.service",
        "homelab-backup.timer",
    ):
        print(f"   Enabling {unit}…")
        run_cmd(f"sudo systemctl enable --now {unit}")

    if shutil.which("pacman"):
        print("   Enabling pacman-sync.timer…")
        run_cmd("sudo systemctl enable --now pacman-sync.timer")
    else:
        print("   ℹ️  pacman not found; skipping pacman-sync.timer")

    run_cmd("sudo systemctl restart homelab-host-api.service", check=False)

    print("   Enabling systemd-timesyncd…")
    run_cmd("sudo systemctl enable --now systemd-timesyncd.service", check=False)
    sync = run_cmd("timedatectl show -p NTPSynchronized --value", check=False) or ""
    if sync.strip() == "yes":
        print("   ✅ System clock is NTP-synchronized")
    else:
        print("   ⚠️  System clock not yet NTP-synchronized")
        print("      If this persists, see ./systemd/timesyncd.conf and restart systemd-timesyncd")

    user = _username_for_puid(os.environ["PUID"]) or _host_user_group()[0]
    added_docker_group = False
    if user != "root":
        groups = run_cmd(f"id -nG {user}", check=False) or ""
        if "docker" not in groups.split():
            print(f"   Adding {user} to the docker group…")
            run_cmd(f"sudo usermod -aG docker {shlex.quote(user)}")
            added_docker_group = True

    print("✅ Systemd host services configured")

    if added_docker_group and os.geteuid() != 0:
        setup_py = shlex.quote(os.path.abspath(__file__))
        py = shlex.quote(sys.executable)
        root = shlex.quote(project_root)
        print("\n🔄 Re-running setup under the docker group (new membership)…")
        os.execvp(
            "sg",
            ["sg", "docker", "-c", f"cd {root} && {py} {setup_py} setup"],
        )


def ensure_env_file() -> dict:
    from setup_utils import (
        detect_homelab_locale,
        load_env,
        phone_region_from_tz,
        run_cmd,
        substitute_env_vars,
    )

    if os.path.exists(".env"):
        print("✅ Environment configuration already exists")
        return load_env(".env")

    print("\n📝 Generating environment configuration...")
    if not os.path.exists(".env.template"):
        print("❌ Template file .env.template not found")
        sys.exit(1)

    from setup_utils import prompt_nonempty, prompt_password, prompt_yes_no

    print("   Enter username and password for homelab services:")
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

    dns_domain = hostname.split(".", 1)[1] if "." in hostname else hostname

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
    print(f"   Detected locale: {language} / {locale} (from host LANG or TZ={tz})")

    os.environ["DASHBOARD_SERVICE_NAME"] = "dashboard"
    os.environ["PIHOLE_SERVICE_NAME"] = "pihole"
    os.environ["DOCKHAND_SERVICE_NAME"] = "dockhand"
    os.environ["VAULTWARDEN_SERVICE_NAME"] = "vaultwarden"
    os.environ["GATUS_SERVICE_NAME"] = "gatus"
    os.environ["GOTIFY_SERVICE_NAME"] = "gotify"
    os.environ["AUTHENTIK_SERVICE_NAME"] = "authentik"
    os.environ["RUSTDESK_SERVICE_NAME"] = "rustdesk"
    os.environ["NEXTCLOUD_SERVICE_NAME"] = "nextcloud"
    os.environ["COLLABORA_SERVICE_NAME"] = "collabora"

    content = substitute_env_vars(content)
    with open(".env", "w", encoding="utf-8") as f:
        f.write(content)

    env = load_env(".env")
    if has_public:
        print("   ✅ Let's Encrypt (Cloudflare DNS-01) mode configured")
    else:
        print("   ✅ Self-signed certificate mode configured")
    print("✅ Environment configuration created")
    return env


def ensure_bootstrap_and_locale(env: dict) -> dict:
    """Shared bootstrap only; per-service secrets are created in Service.setup()."""
    from setup_utils import detect_homelab_locale, phone_region_from_tz

    print("   Ensuring shared bootstrap secrets...")
    os.makedirs("./volumes/secrets", exist_ok=True)
    os.chmod("./volumes/secrets", 0o700)

    for key, default in (
        ("RUSTDESK_SERVICE_NAME", "rustdesk"),
        ("NEXTCLOUD_SERVICE_NAME", "nextcloud"),
        ("COLLABORA_SERVICE_NAME", "collabora"),
    ):
        if not env.get(key):
            with open(".env", "a", encoding="utf-8") as f:
                f.write(f"\n{key}='{default}'\n")
            env[key] = default
            os.environ[key] = default

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
        print(f"   Locale defaults: {env.get('HOMELAB_LANGUAGE')} / {env.get('HOMELAB_LOCALE')}")

    if not os.path.exists("./volumes/secrets/homelab_password") or os.path.getsize(
        "./volumes/secrets/homelab_password"
    ) == 0:
        print("   ⚠️  homelab_password secret is missing from volumes/secrets!")
        from setup_utils import prompt_password

        password = prompt_password(
            "   Please re-enter your homelab Password (min 12 characters): ",
            min_length=12,
        )
        with open("./volumes/secrets/homelab_password", "w", encoding="utf-8") as f:
            f.write(password)
        os.chmod("./volumes/secrets/homelab_password", 0o600)

    return env


def ensure_certificates(env: dict) -> None:
    from setup_utils import run_cmd

    hostname = env.get("HOMELAB_HOSTNAME", "homelab.home.arpa")
    cert_resolver = env.get("TRAEFIK_CERT_RESOLVER", "")

    print("\n🔐 Setting up certificates and keys...")
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
        print("   Let's Encrypt is enabled; also ensuring local CA/fallback certs exist…")

    if not os.path.exists(ca_key) or not os.path.exists(ca_cert):
        print("   Generating local Certificate Authority (CA)...")
        run_cmd(f"openssl genrsa -out {ca_key} 4096")
        run_cmd(
            f'openssl req -x509 -new -nodes -key {ca_key} -sha256 -days 3650 '
            f'-out {ca_cert} -subj "/CN=Homelab Root CA/O=Homelab/C=US"'
        )
        print("   ✅ CA certificate and key generated")

    if not os.path.exists(server_key) or not os.path.exists(server_cert):
        print(f"   Generating server certificate for {hostname}...")
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
        print("   ✅ Server certificate generated")

    # Traefik defaultCertificate paths (stable names, independent of hostname)
    if (
        not os.path.exists(fallback_cert)
        or not os.path.exists(fallback_key)
        or os.path.getsize(fallback_cert) == 0
        or os.path.getsize(fallback_key) == 0
    ):
        shutil.copy(server_cert, fallback_cert)
        shutil.copy(server_key, fallback_key)
        print("   ✅ Traefik fallback homelab.crt / homelab.key ready")

    if os.path.exists(ca_cert):
        print("   Trusting CA certificate locally...")
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

    print("   ✅ SSL certificates ready")


def run_setup() -> None:
    from service import run_all_postsetup, run_all_setup
    from services_registry import get_services
    from setup_utils import run_cmd, wait_for_containers

    print("🏠 Homelab Python Setup Script")
    print("==============================")
    check_prereqs()

    env = ensure_env_file()
    ensure_systemd_services()
    hostname = env.get("HOMELAB_HOSTNAME", "homelab.home.arpa")
    cert_resolver = env.get("TRAEFIK_CERT_RESOLVER", "")
    env = ensure_bootstrap_and_locale(env)
    ensure_certificates(env)

    os.environ.setdefault("PROJECT_ROOT", os.getcwd())

    services = get_services()
    print("\n📁 Running per-service setup()...")
    run_all_setup(services, env)

    # Reload secrets written by services so postsetup / compose-adjacent tools see them
    from setup_utils import ensure_secrets_container_access, load_secrets

    print("\n🔐 Ensuring secrets stay private but readable by containers...")
    ensure_secrets_container_access()
    load_secrets()

    run_cmd("docker network create homelab-net --subnet 10.10.30.0/24 || true")

    print("\n🔨 Building Docker containers...")
    run_cmd("docker compose build", capture=False)

    print("\n🐳 Starting Docker containers...")
    run_cmd("docker compose up -d", capture=False)

    wait_for_containers()
    print("✅ Docker containers started")

    print("\n⚙️  Running per-service postsetup()...")
    run_all_postsetup(services, env)

    print("\n🎉 Homelab Setup Complete!")
    print("==========================")
    print(
        f"📋 Access Information:\n   Username: {env.get('HOMELAB_USERNAME')}\n"
        f"   Email:    {env.get('HOMELAB_USERNAME')}@{hostname}"
    )
    print(f"\n🌐 Web Access:")
    print(f"   Dashboard:  https://{env.get('DASHBOARD_SERVICE_NAME')}.{hostname}")
    ssl_mode = "Self-signed (private)" if cert_resolver != "letsencrypt" else "Public (Let's Encrypt)"
    print(f"\n🔒 SSL Mode: {ssl_mode}")
    if cert_resolver != "letsencrypt":
        print("⚠️  Remember to add the CA certificate to your devices' trust stores!")
        print("   CA Certificate: ./volumes/certificates/homelab-ca.crt")


def run_backup(auto: bool = False) -> None:
    from restic_backup import restic_backup
    from service import run_all_backup
    from services_registry import get_services
    from setup_utils import load_env, load_secrets

    print("🏠 Homelab Cloud Backup")
    print("=======================")
    check_prereqs(extra=["restic"])

    if not os.path.exists(".env"):
        print("❌ .env not found. Run setup first or restore from Restic.")
        sys.exit(1)

    env = load_env(".env")
    load_secrets()
    os.environ.setdefault("PROJECT_ROOT", os.getcwd())

    if auto:
        print("--> Running in automatic mode.")

    services = get_services()
    print("\n💾 Running per-service backup() hooks...")
    run_all_backup(services, env)

    restic_backup(auto=auto)


def run_restore(snapshot: str = "latest") -> None:
    from restic_backup import restic_restore
    from service import run_all_restore, run_all_setup
    from services_registry import get_services
    from setup_utils import load_env, load_secrets, run_cmd, wait_for_containers

    print("🏠 Homelab Cloud Restore")
    print("========================")
    check_prereqs(extra=["restic"])

    print(
        "\n⚠️  This will overwrite local gitignored state (.env, volumes/, */volumes/) "
        "from the Restic snapshot, then start containers and run restore hooks."
    )
    from setup_utils import prompt_yes_no

    if not prompt_yes_no("Proceed? [y/N]: ", default=False):
        print("Restore aborted.")
        sys.exit(0)

    restic_restore(snapshot)

    if not os.path.exists(".env"):
        print("❌ .env missing after restore.")
        sys.exit(1)

    env = load_env(".env")
    load_secrets()
    os.environ.setdefault("PROJECT_ROOT", os.getcwd())

    services = get_services()
    print("\n📁 Re-applying volume permissions via setup()...")
    run_all_setup(services, env)

    run_cmd("docker network create homelab-net --subnet 10.10.30.0/24 || true")
    print("\n🐳 Starting Docker containers...")
    run_cmd("docker compose up -d", capture=False)

    # Apply dumps before waiting on healthchecks. Live Postgres dirs are
    # restic-excluded; apps may be unhealthy until restore() runs.
    print("\n♻️  Running per-service restore() hooks...")
    run_all_restore(services, env)

    wait_for_containers()

    print("\n✅ Restore complete.")


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
    else:
        print(f"Unknown command: {args.command}")
        sys.exit(1)


if __name__ == "__main__":
    main()
