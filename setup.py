#!/usr/bin/env python3
import os
import sys
import shutil
import getpass
import re
import json
import subprocess

# Parse arguments
if "--reset" in sys.argv:
    print("🏠 Homelab Reset Utility")
    print("========================")
    print("\n⚠️  WARNING: This will permanently destroy your entire homelab state:")
    print("   - Stop and remove all Docker containers and networks")
    print("   - Delete all named Docker volumes")
    print("   - Delete your local configuration (.env)")
    print("   - Delete all certificates, configurations, databases, and secrets (volumes/, */volumes/)")
    print("\n🚨 THIS ACTION IS IRREVERSIBLE!")
    
    try:
        confirm = input("\nAre you absolutely sure you want to reset your homelab? (y/N): ").strip().lower()
        if confirm == 'y':
            print("\n🔥 Resetting homelab stack...")
            subprocess.run("docker compose down -v", shell=True)
            subprocess.run("sudo rm -rf .env volumes/ */volumes/", shell=True)
            print("\n✅ Homelab has been successfully reset.")
            sys.exit(0)
        else:
            print("\n❌ Reset aborted.")
            sys.exit(0)
    except KeyboardInterrupt:
        print("\n❌ Reset aborted.")
        sys.exit(1)

print("🏠 Homelab Python Setup Script")
print("==============================")

# 1. Check prerequisites
print("🔍 Checking prerequisites...")
REQUIRED_PROGRAMS = ["openssl", "argon2", "docker", "jq"]
missing = [p for p in REQUIRED_PROGRAMS if not shutil.which(p)]

if missing:
    print(f"❌ Missing required programs: {', '.join(missing)}")
    print("   Please install them and try again.")
    sys.exit(1)
print("✅ All prerequisites found")

from setup_utils import run_cmd, gen_secret, load_env, load_secrets, wait_for_containers, substitute_env_vars, detect_homelab_locale, phone_region_from_tz

# 2. Check or generate .env
if not os.path.exists(".env"):
    print("\n📝 Generating environment configuration...")
    if not os.path.exists(".env.template"):
        print("❌ Template file .env.template not found")
        sys.exit(1)

    print("   Enter username and password for homelab services:")
    username = input("                       Username: ").strip()
    while not username:
        username = input("                       Username: ").strip()

    while True:
        password = getpass.getpass("   Password (min 12 characters): ").strip()
        if len(password) < 12:
            print("   ⚠️  Password is too short. Please try again.")
            continue
        confirm_password = getpass.getpass("   Confirm Password: ").strip()
        if password != confirm_password:
            print("   ⚠️  Passwords do not match. Please try again.")
            continue
        break

    # Get IP Address
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
    while True:
        has_public = input("   Do you have a public domain with Cloudflare DNS? (y/n): ").strip().lower()
        if has_public in ["y", "n"]:
            break
        print("   ⚠️  Please answer with y or n.")

    print("")
    if has_public == "y":
        print("   Enter homelab hostname (public domain, e.g. homelab.your-domain.com):")
    else:
        print("   Enter homelab hostname (private local domain, e.g. homelab.home.arpa):")

    while True:
        hostname = input(f"              Homelab Hostname [{ 'homelab.home.arpa' if has_public == 'n' else '' }]: ").strip()
        if not hostname and has_public == "n":
            hostname = "homelab.home.arpa"
        # validation regex
        if re.match(r'^[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?)+$', hostname):
            break
        print("   ⚠️  That doesn't look like a valid hostname. Please try again.")

    dns_domain = hostname.split(".", 1)[1] if "." in hostname else hostname

    os.makedirs("./volumes/secrets", exist_ok=True)
    os.chmod("./volumes/secrets", 0o700)

    with open("./volumes/secrets/homelab_password", "w") as f:
        f.write(password + "\n")

    # Read template and substitute
    with open(".env.template") as f:
        content = f.read()

    # Retrieve Cert resolver variables early
    cf_token = ""
    acme_email = ""
    if has_public == "y":
        cf_token = input("   Cloudflare DNS API token (Zone.Zone:Read, Zone.DNS:Edit): ").strip()
        while not cf_token:
            cf_token = input("   Cloudflare DNS API token: ").strip()

        print("\n   Let's Encrypt requires a valid e-mail address for certificate expiry notices.")
        while True:
            acme_email = input("   ACME e-mail address: ").strip()
            if re.match(r'^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$', acme_email):
                break
            print("   ⚠️  That doesn't look like a valid e-mail address. Please try again.")

        with open("./volumes/secrets/cf_dns_api_token", "w") as f:
            f.write(cf_token + "\n")
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

    # Default Service Names
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

    # Write .env
    with open(".env", "w") as f:
        f.write(content)

    load_env(".env")

    if has_public == "y":
        print("   ✅ Let's Encrypt (Cloudflare DNS-01) mode configured")
    else:
        print("   ✅ Self-signed certificate mode configured")

    print("✅ Environment configuration created")
else:
    print("✅ Environment configuration already exists")

# Load configuration vars
env = load_env(".env")
hostname = env.get("HOMELAB_HOSTNAME", "homelab.home.arpa")
cert_resolver = env.get("TRAEFIK_CERT_RESOLVER", "")

# 3. Generate secrets
print("   Ensuring secrets are generated natively...")
os.makedirs("./volumes/secrets", exist_ok=True)
os.chmod("./volumes/secrets", 0o700)

gen_secret("homelab_api_session_secret", 64)
gen_secret("vaultwarden_admin_token_plain", 48)
gen_secret("vaultwarden_admin_token", 48) # Placeholder to be overwritten
gen_secret("vaultwarden_oidc_secret", 64)
gen_secret("dashboard_oidc_secret", 64)
gen_secret("rustdesk_oidc_secret", 64)
gen_secret("rustdesk_api_jwt_key", 64)
gen_secret("rustdesk_admin_password", 32)
gen_secret("nextcloud_oidc_secret", 64)
gen_secret("nextcloud_db_password", 32)
gen_secret("nextcloud_admin_password", 32)
gen_secret("collabora_admin_password", 24)
gen_secret("gotify_admin_password", 32)
gen_secret("authentik_secret_key", 50)
gen_secret("authentik_pg_pass", 32)
gen_secret("authentik_akadmin_password", 32)

# Ensure placeholder file exists for rustdesk_public_key to prevent Docker from creating a directory
os.makedirs("./volumes/public-configs", exist_ok=True)
rustdesk_key_path = "./volumes/public-configs/rustdesk_public_key"
if not os.path.exists(rustdesk_key_path):
    with open(rustdesk_key_path, "w") as f:
        f.write("\n")

# Existing installs: ensure RUSTDESK_SERVICE_NAME is present
if not env.get("RUSTDESK_SERVICE_NAME"):
    with open(".env", "a") as f:
        f.write("\nRUSTDESK_SERVICE_NAME='rustdesk'\n")
    env["RUSTDESK_SERVICE_NAME"] = "rustdesk"
    os.environ["RUSTDESK_SERVICE_NAME"] = "rustdesk"

if not env.get("NEXTCLOUD_SERVICE_NAME"):
    with open(".env", "a") as f:
        f.write("\nNEXTCLOUD_SERVICE_NAME='nextcloud'\n")
    env["NEXTCLOUD_SERVICE_NAME"] = "nextcloud"
    os.environ["NEXTCLOUD_SERVICE_NAME"] = "nextcloud"

if not env.get("COLLABORA_SERVICE_NAME"):
    with open(".env", "a") as f:
        f.write("\nCOLLABORA_SERVICE_NAME='collabora'\n")
    env["COLLABORA_SERVICE_NAME"] = "collabora"
    os.environ["COLLABORA_SERVICE_NAME"] = "collabora"

if not env.get("HOMELAB_LANGUAGE") or not env.get("HOMELAB_LOCALE"):
    tz = env.get("TZ") or os.environ.get("TZ") or "UTC"
    language, locale = detect_homelab_locale(tz, region=phone_region_from_tz(tz))
    with open(".env", "a") as f:
        if not env.get("HOMELAB_LANGUAGE"):
            f.write(f"\nHOMELAB_LANGUAGE='{language}'\n")
            env["HOMELAB_LANGUAGE"] = language
            os.environ["HOMELAB_LANGUAGE"] = language
        if not env.get("HOMELAB_LOCALE"):
            f.write(f"\nHOMELAB_LOCALE='{locale}'\n")
            env["HOMELAB_LOCALE"] = locale
            os.environ["HOMELAB_LOCALE"] = locale
    print(f"   Locale defaults: {env.get('HOMELAB_LANGUAGE')} / {env.get('HOMELAB_LOCALE')}")

# Ensure homelab_password exists
if not os.path.exists("./volumes/secrets/homelab_password") or os.path.getsize("./volumes/secrets/homelab_password") == 0:
    print("   ⚠️  homelab_password secret is missing from volumes/secrets!")
    while True:
        password = getpass.getpass("   Please re-enter your homelab Password (min 12 characters): ").strip()
        if len(password) < 12:
            print("   ⚠️  Password is too short. Please try again.")
        else:
            break
    with open("./volumes/secrets/homelab_password", "w") as f:
        f.write(password + "\n")

# Load secrets into os.environ
load_secrets()



# 4. Certificates and Keys
print("\n🔐 Setting up certificates and keys...")
certs_dir = "./volumes/certificates"
os.makedirs(certs_dir, exist_ok=True)

ca_key = f"{certs_dir}/homelab-ca.key"
ca_cert = f"{certs_dir}/homelab-ca.crt"
server_key = f"{certs_dir}/{hostname}.key"
server_cert = f"{certs_dir}/{hostname}.crt"
fallback_key = f"{certs_dir}/homelab.key"
fallback_cert = f"{certs_dir}/homelab.crt"

if cert_resolver == "letsencrypt":
    print("   Using Let's Encrypt certificates. Skipping self-signed cert generation.")
else:
    if not os.path.exists(ca_key) or not os.path.exists(ca_cert):
        print("   Generating local Certificate Authority (CA)...")
        run_cmd(f"openssl genrsa -out {ca_key} 4096")
        run_cmd(f'openssl req -x509 -new -nodes -key {ca_key} -sha256 -days 3650 -out {ca_cert} -subj "/CN=Homelab Root CA/O=Homelab/C=US"')
        print("   ✅ CA certificate and key generated")

    if not os.path.exists(server_key) or not os.path.exists(server_cert):
        print(f"   Generating server certificate for {hostname}...")
        conf_file = "/tmp/server_ssl_config.cnf"
        csr_file = f"/tmp/{hostname}.csr"

        # Create config file
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
        with open(conf_file, "w") as f:
            f.write(config_content)

        run_cmd(f"openssl req -new -nodes -out {csr_file} -keyout {server_key} -config {conf_file}")
        run_cmd(f"openssl x509 -req -in {csr_file} -CA {ca_cert} -CAkey {ca_key} -CAcreateserial -out {server_cert} -days 3650 -sha256 -extfile {conf_file} -extensions v3_req")

        shutil.copy(server_cert, fallback_cert)
        shutil.copy(server_key, fallback_key)

        # Try to trust CA locally
        if os.path.exists(ca_cert):
            print("   Trusting CA certificate locally...")
            if os.path.exists("/etc/ca-certificates/trust-source/anchors") and shutil.which("trust"):
                run_cmd(f"sudo cp {ca_cert} /etc/ca-certificates/trust-source/anchors/ && sudo trust extract-compat >/dev/null 2>&1 || true")
            elif shutil.which("update-ca-certificates"):
                dest = f"/usr/local/share/ca-certificates/{os.path.basename(ca_cert)}"
                run_cmd(f"sudo cp {ca_cert} {dest} && sudo update-ca-certificates >/dev/null 2>&1 || true")
            elif os.path.exists("/etc/pki/ca-trust/source/anchors") and shutil.which("update-ca-trust"):
                run_cmd(f"sudo cp {ca_cert} /etc/pki/ca-trust/source/anchors/ && sudo update-ca-trust extract >/dev/null 2>&1 || true")

        # Cleanup
        if os.path.exists(conf_file): os.remove(conf_file)
        if os.path.exists(csr_file): os.remove(csr_file)
        print("   ✅ SSL certificates ready")

# 5. Pre-compose file setup (directory creation, configurations)
import authentik.setup as authentik_setup
authentik_setup.setup(env)

import apprise.setup as apprise_setup
apprise_setup.pre_setup(env)

import vaultwarden.setup as vaultwarden_setup
vaultwarden_setup.setup(env)

import traefik.setup as traefik_setup
traefik_setup.setup(env)

# 6. Start docker containers
run_cmd("docker network create homelab-net --subnet 10.10.30.0/24 || true")

print("\n🛠️ Building Docker containers...")
run_cmd("docker compose build")

print("\n🐳 Starting Docker containers...")
run_cmd("docker compose up -d")

wait_for_containers()
print("✅ Docker containers started")

# 7. Per-service configuration (post-container-start)
import apprise.setup as apprise_setup
apprise_setup.setup(env)

import rustdesk.setup as rustdesk_setup
rustdesk_setup.setup(env)

import nextcloud.setup as nextcloud_setup
nextcloud_setup.setup(env)

# 9. Summary
print("\n🎉 Homelab Setup Complete!")
print("==========================")
print(f"📋 Access Information:\n   Username: {env.get('HOMELAB_USERNAME')}\n   Email:    {env.get('HOMELAB_USERNAME')}@{hostname}")

gotify_pwd = os.environ.get("GOTIFY_ADMIN_PASSWORD", "")

print(f"\n🌐 Web Access:")
print(f"   Dashboard:  https://{env.get('DASHBOARD_SERVICE_NAME')}.{hostname}")
print(f"   RustDesk:   https://{env.get('RUSTDESK_SERVICE_NAME', 'rustdesk')}.{hostname}/_admin/")
print(f"   Nextcloud:  https://{env.get('NEXTCLOUD_SERVICE_NAME', 'nextcloud')}.{hostname}")
print(f"   Collabora:  https://{env.get('COLLABORA_SERVICE_NAME', 'collabora')}.{hostname}")
ssl_mode = 'Self-signed (private)' if cert_resolver != 'letsencrypt' else "Public (Let's Encrypt)"
print(f"\n🔒 SSL Mode: {ssl_mode}")
if cert_resolver != "letsencrypt":
    print("⚠️  Remember to add the CA certificate to your devices' trust stores!")
    print("   CA Certificate: ./volumes/certificates/homelab-ca.crt")
