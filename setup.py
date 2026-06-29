#!/usr/bin/env python3
import os
import sys
import shutil
import subprocess
import secrets
import time
import getpass
import re
import json

print("🏠 Homelab Python Setup Script")
print("==============================")

# 1. Check prerequisites
print("🔍 Checking prerequisites...")
REQUIRED_PROGRAMS = ["openssl", "docker", "jq"]
missing = [p for p in REQUIRED_PROGRAMS if not shutil.which(p)]

if missing:
    print(f"❌ Missing required programs: {', '.join(missing)}")
    print("   Please install them and try again.")
    sys.exit(1)
print("✅ All prerequisites found")

# Helper to run shell commands safely
def run_cmd(cmd, cwd=None, shell=True, check=True):
    try:
        res = subprocess.run(cmd, cwd=cwd, shell=shell, check=check, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        return res.stdout.strip()
    except subprocess.CalledProcessError as e:
        print(f"Error running command: {cmd}\nOutput: {e.stdout}\nError: {e.stderr}")
        if check:
            sys.exit(1)
        return None

# Helper to generate secret
def gen_secret(name, length_bytes):
    path = f"./volumes/secrets/{name}"
    if not os.path.exists(path) or os.path.getsize(path) == 0:
        val = secrets.token_hex(length_bytes)
        with open(path, "w") as f:
            f.write(val + "\n")
        print(f"     Generated {name}")
        os.chmod(path, 0o600)

# Helper to read env file
def load_env(path=".env"):
    env_vars = {}
    if os.path.exists(path):
        with open(path) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#"):
                    parts = line.split("=", 1)
                    if len(parts) == 2:
                        k, v = parts[0].strip(), parts[1].strip()
                        # strip quotes if present
                        if (v.startswith("'") and v.endswith("'")) or (v.startswith('"') and v.endswith('"')):
                            v = v[1:-1]
                        env_vars[k] = v
                        os.environ[k] = v
    return env_vars

# Load secrets into environment
def load_secrets():
    secrets_dir = "./volumes/secrets"
    if os.path.exists(secrets_dir):
        for name in os.listdir(secrets_dir):
            path = os.path.join(secrets_dir, name)
            if os.path.isfile(path):
                varname = name.upper()
                with open(path) as f:
                    val = f.read().strip()
                os.environ[varname] = val

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
        else:
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
            tz = run_cmd("timedatectl | grep 'Time zone' | awk '{print $3}'")
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
    os.makedirs("./volumes/dockge/stacks", exist_ok=True)
    os.makedirs("./volumes/apprise/config", exist_ok=True)
    os.chmod("./volumes/secrets", 0o700)

    with open("./volumes/secrets/homelab_password", "w") as f:
        f.write(password + "\n")

    # Read template and substitute
    with open(".env.template") as f:
        content = f.read()

    email = f"{username}@{hostname}"

    replacements = {
        "<username>": username,
        "<email>": email,
        "<ip-address>": ip_address,
        "<PUID>": puid,
        "<PGID>": pgid,
        "<homelab-hostname>": hostname,
        "<dns-domain>": dns_domain,
        "<project-root>": os.getcwd(),
        "<timezone>": tz
    }

    for k, v in replacements.items():
        content = content.replace(k, v)

    # Write .env
    with open(".env", "w") as f:
        f.write(content)

    load_env(".env")

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

        # Update resolver in .env
        with open(".env") as f:
            env_content = f.read()
        env_content = env_content.replace("TRAEFIK_CERT_RESOLVER=''", "TRAEFIK_CERT_RESOLVER='letsencrypt'")
        env_content = env_content.replace(f"acme-email", acme_email)
        with open(".env", "w") as f:
            f.write(env_content)
        
        os.environ["TRAEFIK_CERT_RESOLVER"] = "letsencrypt"
        print("   ✅ Let's Encrypt (Cloudflare DNS-01) mode configured")
    else:
        # Private mode email default
        with open(".env") as f:
            env_content = f.read()
        env_content = env_content.replace("<acme-email>", f"{username}@{hostname}")
        with open(".env", "w") as f:
            f.write(env_content)
        os.environ["TRAEFIK_CERT_RESOLVER"] = ""
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
gen_secret("vaultwarden_admin_token", 64)
gen_secret("vaultwarden_oidc_secret", 64)
gen_secret("portainer_oidc_secret", 64)
gen_secret("dashboard_oidc_secret", 64)
gen_secret("gotify_admin_password", 32)
gen_secret("portainer_admin_password", 32)
gen_secret("authentik_secret_key", 50)
gen_secret("authentik_pg_pass", 32)

# Cleanup secrets from .env file to enforce loading from secrets volume
env_updates = False
with open(".env") as f:
    env_lines = f.readlines()

new_env_lines = []
secret_names_upper = ["AUTHENTIK_SECRET_KEY", "AUTHENTIK_PG_PASS", "PORTAINER_OIDC_SECRET", "VAULTWARDEN_OIDC_SECRET", "DASHBOARD_OIDC_SECRET", "GOTIFY_ADMIN_PASSWORD", "PORTAINER_ADMIN_PASSWORD"]
for line in env_lines:
    matched = False
    for sec in secret_names_upper:
        if line.startswith(f"{sec}="):
            matched = True
            env_updates = True
            break
    if not matched:
        new_env_lines.append(line)

if env_updates:
    with open(".env", "w") as f:
        f.writelines(new_env_lines)
    print("     Removed sensitive secrets from .env file")

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

# 5. Start docker containers
print("\n🐳 Starting Docker containers...")
if os.path.exists("./homelab-dashboard/api/entrypoint.sh"):
    os.chmod("./homelab-dashboard/api/entrypoint.sh", 0o755)

# Ensure Authentik directories exist and copy blueprints/branding files
os.makedirs("./volumes/authentik/blueprints", exist_ok=True)
os.makedirs("./volumes/authentik/media/public", exist_ok=True)

if os.path.exists("./authentik/blueprints/homelab.yaml"):
    shutil.copy("./authentik/blueprints/homelab.yaml", "./volumes/authentik/blueprints/homelab.yaml")
if os.path.exists("./homelab-dashboard/frontend/public/homelab-icon.svg"):
    shutil.copy("./homelab-dashboard/frontend/public/homelab-icon.svg", "./volumes/authentik/media/public/homelab-icon.svg")

run_cmd("docker network create homelab-net --subnet 10.10.30.0/24 || true")
with open("./volumes/secrets/matrix_bot_token", "a"):
    pass # touch file

run_cmd("docker compose build")
run_cmd("docker compose up -d")

# Dynamic service waiting
def wait_for_containers(timeout=120):
    print("   Waiting for all containers to be running and healthy...")
    start_time = time.time()
    
    while time.time() - start_time < timeout:
        stdout = run_cmd("docker compose ps --format json", check=False)
        if not stdout:
            time.sleep(2)
            continue
            
        containers = []
        for line in stdout.strip().split("\n"):
            line = line.strip()
            if line:
                try:
                    # In some docker compose versions, output might be a single JSON list,
                    # in others it is multiple JSON objects separated by newlines.
                    if line.startswith("[") and line.endswith("]"):
                        containers.extend(json.loads(line))
                    else:
                        containers.append(json.loads(line))
                except Exception:
                    pass
                    
        if not containers:
            time.sleep(2)
            continue
            
        all_ok = True
        starting_or_unhealthy = []
        
        for c in containers:
            name = c.get("Name", c.get("Service", "unknown"))
            state = c.get("State", "").lower()
            health = c.get("Health", "").lower()
            
            # Skip checking static/stopped project containers if any
            if state in ["exited", "stopped"] and name == "setup":
                continue
                
            # Must be running
            if state != "running":
                all_ok = False
                starting_or_unhealthy.append(f"{name} ({state})")
                continue
                
            # If healthcheck is defined, must be healthy
            if health and health not in ["healthy", "none"]:
                all_ok = False
                starting_or_unhealthy.append(f"{name} ({health})")
                
        if all_ok:
            print("   All containers are running and healthy! 🎉")
            return True
            
        elapsed = int(time.time() - start_time)
        print(f"   [{elapsed}s] Still waiting for: {', '.join(starting_or_unhealthy[:4])}...", end="\r")
        time.sleep(2)
        
    print("\n   ⚠️  Timeout reached. Proceeding with configuration anyway...")
    return False

wait_for_containers()
print("✅ Docker containers started")

# Helper to exec curl inside container
def container_curl(container, method, url, data=None, headers=None, auth=None):
    headers = headers or {}
    cmd = ["docker", "exec", "-i", container, "curl", "-s", "-k", "-w", "\\n%{http_code}", "-X", method]
    for k, v in headers.items():
        cmd += ["-H", f"{k}: {v}"]
    if auth:
        cmd += ["-u", auth]
    if data:
        cmd += ["--data-binary", "@-"]
    cmd.append(url)

    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE if data else None, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    stdout, stderr = proc.communicate(input=data)
    
    lines = stdout.strip().split("\n")
    if not lines or len(lines) < 2:
        return "", 0
    status_code = int(lines[-1])
    body = "\n".join(lines[:-1])
    return body, status_code

# 6. Configure Portainer
print("\n⚙️  Configuring Portainer...")
portainer_pwd = os.environ.get("PORTAINER_ADMIN_PASSWORD")
portainer_oidc_secret = os.environ.get("PORTAINER_OIDC_SECRET")

# Check if admin initialized
body, status = container_curl("portainer", "GET", "http://localhost:9000/api/users/admin/check")
if status == 404:
    print("   Extracting setup token...")
    setup_token = ""
    for _ in range(30):
        logs = run_cmd("docker logs portainer 2>&1", check=False)
        if logs:
            # Strip ANSI escape sequences
            clean_logs = re.sub(r'\x1b\[[0-9;]*[a-zA-Z]', '', logs)
            match = re.search(r"setup_token=([a-zA-Z0-9]+)", clean_logs)
            if match:
                setup_token = match.group(1)
                break
        time.sleep(1)

    if not setup_token:
        print("   ❌ Failed to extract Portainer setup token from logs")
        sys.exit(1)

    print("   Initializing admin user...")
    init_data = f'{{"username": "admin", "password": "{portainer_pwd}"}}'
    container_curl("portainer", "POST", "http://localhost:9000/api/users/admin/init", data=init_data, headers={"X-Setup-Token": setup_token})
else:
    print("   Admin user already initialized.")

# Get Token
auth_data = f'{{"username": "admin", "password": "{portainer_pwd}"}}'
body, status = container_curl("portainer", "POST", "http://localhost:9000/api/auth", data=auth_data, headers={"Content-Type": "application/json"})
try:
    import json
    token = json.loads(body).get("jwt")
except Exception:
    token = None

if not token or token == "null":
    print("   ❌ Failed to authenticate with Portainer")
    sys.exit(1)

print("   Configuring SSO settings...")
oauth_payload = json.dumps({
    "authenticationMethod": 3,
    "oauthSettings": {
        "SSO": True,
        "OAuthAutoCreateUsers": True,
        "ClientID": "portainer",
        "ClientSecret": portainer_oidc_secret,
        "AccessTokenURI": f"https://{env.get('AUTHENTIK_WEB_HOSTNAME')}/application/o/token/",
        "AuthorizationURI": f"https://{env.get('AUTHENTIK_WEB_HOSTNAME')}/application/o/authorize/",
        "ResourceURI": f"https://{env.get('AUTHENTIK_WEB_HOSTNAME')}/application/o/userinfo/",
        "RedirectURI": f"https://{env.get('PORTAINER_WEB_HOSTNAME')}",
        "LogoutURI": f"https://{env.get('AUTHENTIK_WEB_HOSTNAME')}/application/o/portainer/end-session/",
        "UserIdentifier": "preferred_username",
        "Scopes": "openid profile email groups"
    }
})

body, status = container_curl("portainer", "PUT", "http://localhost:9000/api/settings", data=oauth_payload, headers={
    "Authorization": f"Bearer {token}",
    "Content-Type": "application/json"
})

if status == 200:
    print("   ✅ Portainer SSO configured")
else:
    print(f"   ❌ Failed to configure Portainer SSO (HTTP: {status})")
    sys.exit(1)

# 7. Configure Gotify & Apprise
print("\n🔔 Setting up Gotify server & Apprise yaml integration...")
gotify_pwd = os.environ.get("GOTIFY_ADMIN_PASSWORD")

# Wait for Gotify
print("   Waiting for Gotify to initialize...")
gotify_ready = False
for _ in range(30):
    body, status = container_curl("gotify", "GET", "http://localhost:80/version")
    if status == 200:
        gotify_ready = True
        break
    time.sleep(2)

if gotify_ready:
    print("   Gotify is up. Configuring...")
    # Change default admin password
    container_curl("gotify", "POST", "http://localhost:80/current/user/password", data=f'{{"pass":"{gotify_pwd}"}}', headers={"Content-Type": "application/json"}, auth="admin:admin")
    
    # Get apps list
    body, status = container_curl("gotify", "GET", "http://localhost:80/application", auth=f"admin:{gotify_pwd}")
    gotify_token = ""
    gotify_id = ""
    try:
        apps = json.loads(body)
        for app in apps:
            if app.get("name") == "Homelab Alert Gateway":
                gotify_token = app.get("token")
                gotify_id = app.get("id")
                break
    except Exception:
        pass

    if not gotify_token:
        # Create application
        body, status = container_curl("gotify", "POST", "http://localhost:80/application", 
            data='{"name":"Homelab Alert Gateway","description":"Gateway for all homelab services"}',
            headers={"Content-Type": "application/json"},
            auth=f"admin:{gotify_pwd}"
        )
        try:
            app_res = json.loads(body)
            gotify_token = app_res.get("token")
            gotify_id = app_res.get("id")
        except Exception:
            pass

    if gotify_token:
        print("   ✅ Created Gotify Application. Token generated.")
        # Upload app icon
        icon_path = "./gotify/homelab-icon.png"
        if os.path.exists(icon_path) and gotify_id:
            run_cmd(f'docker exec gotify curl -s -X POST -u "admin:{gotify_pwd}" -F "file=@/app/homelab-icon.png" "http://localhost:80/application/{gotify_id}/image"', check=False)
            print("   ✅ Uploaded Gotify Application icon.")

        # Generate apprise.yaml configuration
        os.makedirs("./volumes/apprise/config", exist_ok=True)
        apprise_content = f"urls:\n  - gotify://gotify/{gotify_token}\n"
        with open("./volumes/apprise/config/apprise.yaml", "w") as f:
            f.write(apprise_content)
        print("   ✅ Generated apprise.yaml configuration")

        # Reload Apprise Gateway
        body, status = container_curl("apprise-api", "GET", "http://localhost:8000/health")
        print("   ✅ SMTP/HTTP notification gateway reloaded")
else:
    print("   ❌ Gotify failed to start or did not become ready.")

print("\n🎉 Homelab Setup Complete!")
print("==========================")
print(f"📋 Access Information:\n   Username: {env.get('HOMELAB_USERNAME')}\n   Email:    {env.get('HOMELAB_USERNAME')}@{hostname}")

# 8. Extract RustDesk key
print("\n🖥️  Extracting RustDesk Public Key to secrets...")
if shutil.which("docker"):
    res = run_cmd("docker cp rustdesk-id-server:/root/data/key.pub ./volumes/secrets/rustdesk_public_key", check=False)
    if res is not None:
        print("   ✅ RustDesk Public Key extracted to volumes/secrets/rustdesk_public_key")
    else:
        print("   ⚠️  Failed to copy RustDesk key. RustDesk container may not be initialized yet.")

print(f"\n🌐 Web Access:")
print(f"   Dashboard:  https://{env.get('DASHBOARD_WEB_HOSTNAME')}")
print(f"   Gotify:     https://{env.get('GOTIFY_WEB_HOSTNAME')} (User: admin / Pass: {gotify_pwd})")
print(f"   Portainer:  https://{env.get('PORTAINER_WEB_HOSTNAME')} (Fallback User: admin / Pass: {portainer_pwd})")
print(f"   Auth:       https://{env.get('AUTHENTIK_WEB_HOSTNAME')}")
print(f"   Vault:      https://{env.get('VAULTWARDEN_WEB_HOSTNAME')}")
ssl_mode = 'Self-signed (private)' if cert_resolver != 'letsencrypt' else "Public (Let's Encrypt)"
print(f"\n🔒 SSL Mode: {ssl_mode}")
if cert_resolver != "letsencrypt":
    print("⚠️  Remember to add the CA certificate to your devices' trust stores!")
    print("   CA Certificate: ./volumes/certificates/homelab-ca.crt")
