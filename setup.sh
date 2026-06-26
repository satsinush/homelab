#!/bin/bash

# Exit immediately if a command exits with a non-zero status.
set -e

echo "🏠 Homelab Setup Script"
echo "======================="

# Check if required programs are installed
echo "🔍 Checking prerequisites..."
REQUIRED_PROGRAMS=(openssl htpasswd sed grep xargs docker jq)
MISSING_PROGRAMS=()

for program in "${REQUIRED_PROGRAMS[@]}"; do
  if ! command -v "$program" &> /dev/null; then
    MISSING_PROGRAMS+=("$program")
  fi
done

if [ ${#MISSING_PROGRAMS[@]} -ne 0 ]; then
  echo "❌ Missing required programs: ${MISSING_PROGRAMS[*]}"
  echo "   Please install them and try again."
  exit 1
fi
echo "✅ All prerequisites found"

# Check if .env file exists, if not, generate it
if [ ! -f .env ]; then
  echo ""
  echo "📝 Generating environment configuration..."

  TEMPLATE_FILE=".env.template"
  OUTPUT_FILE=".env"

  # Check if the template file exists
  if [ ! -f "$TEMPLATE_FILE" ]; then
      echo "❌ Template file $TEMPLATE_FILE not found"
      exit 1
  fi

  echo "   Enter username and password for homelab services:"
  read -p "                       Username: " USERNAME

  while true; do
    read -p "   Password (min 12 characters): " PASSWORD
    if [ ${#PASSWORD} -lt 12 ]; then
      echo "   ⚠️  Password is too short. Please try again."
    else
      break
    fi
  done

  # echo "   Enter host device IP address:"
  # read -p "                     IP Address: " IP_ADDRESS
  # echo

  IP_ADDRESS=$(ip route get 1 | awk '{print $7;exit}')

  # echo "   Enter PUID and PGID for file permissions:"
  # read -p "                           PUID: " PUID
  # read -p "                           PGID: " PGID

  PUID=$(id -u)
  PGID=$(id -g)
  
  TZ=$(timedatectl | grep "Time zone" | awk '{print $3}')

  echo ""
  echo "   SSL Certificate Mode:"
  echo "   Traefik supports two modes:"
  echo "     • Public  (y) — Let's Encrypt via Cloudflare DNS-01; requires a public domain"
  echo "     • Private (n) — Self-signed CA generated locally (no public domain needed)"
  while true; do
    read -p "   Do you have a public domain with Cloudflare DNS? (y/n): " HAS_PUBLIC_DOMAIN
    if [ "$HAS_PUBLIC_DOMAIN" = "y" ] || [ "$HAS_PUBLIC_DOMAIN" = "Y" ] || [ "$HAS_PUBLIC_DOMAIN" = "n" ] || [ "$HAS_PUBLIC_DOMAIN" = "N" ]; then
      break
    else
      echo "   ⚠️  Please answer with y or n."
    fi
  done

  echo ""
  if [ "$HAS_PUBLIC_DOMAIN" = "y" ] || [ "$HAS_PUBLIC_DOMAIN" = "Y" ]; then
    echo "   Enter homelab hostname (public domain, e.g. homelab.your-domain.com):"
  else
    echo "   Enter homelab hostname (private local domain, e.g. homelab.home.arpa):"
  fi
  while true; do
    if [ "$HAS_PUBLIC_DOMAIN" = "y" ] || [ "$HAS_PUBLIC_DOMAIN" = "Y" ]; then
      read -p "              Homelab Hostname: " HOMELAB_HOSTNAME_INPUT
    else
      read -p "              Homelab Hostname [homelab.home.arpa]: " HOMELAB_HOSTNAME_INPUT
      HOMELAB_HOSTNAME_INPUT="${HOMELAB_HOSTNAME_INPUT:-homelab.home.arpa}"
    fi
    # Must contain at least one dot (two labels minimum)
    if echo "$HOMELAB_HOSTNAME_INPUT" | grep -qE '^[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?)+$'; then
      break
    else
      echo "   ⚠️  That doesn't look like a valid hostname (e.g. homelab.home.arpa). Please try again."
    fi
  done
  # Derive DNS_DOMAIN (everything after the first label)
  DNS_DOMAIN_INPUT="${HOMELAB_HOSTNAME_INPUT#*.}"

  echo "   Generating security tokens..."

  # Create the new .env file
  cp "$TEMPLATE_FILE" "$OUTPUT_FILE"

  # Generate secrets for replacement

  
  # Also store the plaintext password since we just prompted for it
  mkdir -p ./volumes/secrets
  mkdir -p ./volumes/dockge/stacks
  chmod 700 ./volumes/secrets
  echo "$PASSWORD" > ./volumes/secrets/homelab_password
  
  sed -i "s|<username>|$USERNAME|g" "$OUTPUT_FILE"
  sed -i "s|<ip-address>|$IP_ADDRESS|g" "$OUTPUT_FILE"
  sed -i "s|<PUID>|$PUID|g" "$OUTPUT_FILE"
  sed -i "s|<PGID>|$PGID|g" "$OUTPUT_FILE"
  sed -i "s|<homelab-hostname>|$HOMELAB_HOSTNAME_INPUT|g" "$OUTPUT_FILE"
  sed -i "s|<dns-domain>|$DNS_DOMAIN_INPUT|g" "$OUTPUT_FILE"
  sed -i "s|<project-root>|$(pwd)|g" "$OUTPUT_FILE"
  sed -i "s|<timezone>|$TZ|g" "$OUTPUT_FILE"
  
  # Load the generated variables from .env to the environment for the rest of the script
  export $(grep -v '^#' .env | sed 's/\r$//' | xargs)

  echo ""
  if [ "$HAS_PUBLIC_DOMAIN" = "y" ] || [ "$HAS_PUBLIC_DOMAIN" = "Y" ]; then
    read -p "   Cloudflare DNS API token (Zone.Zone:Read, Zone.DNS:Edit): " CF_DNS_API_TOKEN_INPUT
    echo ""
    echo "   Let's Encrypt requires a valid e-mail address for certificate expiry notices."
    echo "   💡 Tip: You can also use ${USERNAME}@${HOMELAB_HOSTNAME_INPUT} and set up Cloudflare Email"
    echo "      Routing to forward it to your real inbox (see README for instructions)."
    while true; do
      read -p "   ACME e-mail address: " ACME_EMAIL_INPUT
      # local-part@domain: local-part is non-empty with no '@', domain has at least one label with a dot
      if echo "$ACME_EMAIL_INPUT" | grep -qE '^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$'; then
        break
      else
        echo "   ⚠️  That doesn't look like a valid e-mail address. Please try again."
      fi
    done
    echo "$CF_DNS_API_TOKEN_INPUT" > ./volumes/secrets/cf_dns_api_token
    chmod 600 ./volumes/secrets/cf_dns_api_token
    sed -i "s|TRAEFIK_CERT_RESOLVER=''|TRAEFIK_CERT_RESOLVER='letsencrypt'|g" "$OUTPUT_FILE"
    sed -i "s|<acme-email>|$ACME_EMAIL_INPUT|g" "$OUTPUT_FILE"
    # Also export to the current shell so the cert-generation block below can read it
    # without relying solely on the .env load that follows.
    TRAEFIK_CERT_RESOLVER="letsencrypt"
    echo "   ✅ Let's Encrypt (Cloudflare DNS-01) mode configured"
  else
    # Private mode: derive a local email from the username and homelab hostname.
    # Let's Encrypt is not used here, so no real address is needed.
    sed -i "s|<acme-email>|${USERNAME}@${HOMELAB_HOSTNAME_INPUT}|g" "$OUTPUT_FILE"
    TRAEFIK_CERT_RESOLVER=""
    echo "   ✅ Self-signed certificate mode configured"
  fi

  echo "✅ Environment configuration created"
else
  echo "✅ Environment configuration already exists"
fi

# Load environment variables from the .env file
if [ -f .env ]; then
  export $(grep -v '^#' .env | sed 's/\r$//' | xargs)
fi

echo "   Ensuring secrets are generated natively..."
mkdir -p ./volumes/secrets
chmod 700 ./volumes/secrets

# Helper to generate secret if missing or empty
gen_secret() {
  local file="./volumes/secrets/$1"
  if [ ! -s "$file" ]; then
    openssl rand -hex "$2" > "$file"
    echo "     Generated $1"
  fi
}

gen_secret homelab_api_session_secret 64
gen_secret vaultwarden_admin_token 64
gen_secret vaultwarden_oidc_secret 64
gen_secret portainer_oidc_secret 64
gen_secret dashboard_oidc_secret 64
gen_secret gotify_admin_password 32
gen_secret portainer_admin_password 32
gen_secret authentik_secret_key 50
gen_secret authentik_pg_pass 32

# Ensure secrets are removed from the .env file as they are now loaded from volume-mounted files
for secret_name in authentik_secret_key authentik_pg_pass portainer_oidc_secret vaultwarden_oidc_secret dashboard_oidc_secret gotify_admin_password portainer_admin_password; do
  env_name=$(echo "$secret_name" | tr 'a-z' 'A-Z')
  if grep -q "^${env_name}=" .env; then
    # Use sed to safely remove the line
    sed -i "/^${env_name}=/d" .env
    echo "     Removed ${env_name} from .env"
  fi
done


if [ ! -s ./volumes/secrets/homelab_password ]; then
  echo "   ⚠️  homelab_password secret is missing from volumes/secrets!"
  while true; do
    read -p "   Please re-enter your homelab Password (min 12 characters): " PASSWORD
    if [ ${#PASSWORD} -lt 12 ]; then
      echo "   ⚠️  Password is too short. Please try again."
    else
      break
    fi
  done
fi

chmod 600 ./volumes/secrets/*

# Export all secrets from files in volumes/secrets as uppercase env variables
for f in ./volumes/secrets/*; do
  if [ -f "$f" ]; then
    varname=$(basename "$f" | tr 'a-z' 'A-Z')
    export "$varname"="$(cat "$f")"
  fi
done

# Additional variables will be dynamically loaded from the volumes/secrets folder

echo ""
echo "🔐 Setting up certificates and keys..."

# --- Configuration Variables ---
CERT_DAYS=3650 # Validity period in days (10 years)
KEY_BITS=4096  # RSA key bits for stronger security
CERTS_DIR="./volumes/certificates"

# CA files
CA_KEY_OUT="${CERTS_DIR}/homelab-ca.key"
CA_CERT_OUT="${CERTS_DIR}/homelab-ca.crt"

# Server Certificate files
KEY_OUT="${CERTS_DIR}/${HOMELAB_HOSTNAME}.key"
CERT_OUT="${CERTS_DIR}/${HOMELAB_HOSTNAME}.crt"
FALLBACK_KEY_OUT="${CERTS_DIR}/homelab.key"
FALLBACK_CERT_OUT="${CERTS_DIR}/homelab.crt"
CSR_OUT="/tmp/${HOMELAB_HOSTNAME}.csr"
CONF_FILE="/tmp/server_ssl_config.cnf"

# --- Certificate Details ---
COMMON_NAME="${HOMELAB_HOSTNAME}"

# Subject Alternative Names for the server certificate.
# A wildcard covers all immediate subdomains; the bare hostname is listed explicitly.
declare -a SAN_DOMAINS=(
    "*.${HOMELAB_HOSTNAME}"
    "${HOMELAB_HOSTNAME}"
)

# --- Ensure SSL directory exists ---
mkdir -p "$CERTS_DIR"

# --- Ensure Traefik ACME storage file exists (required even in private mode) ---
TRAEFIK_DIR="./volumes/traefik"
mkdir -p "$TRAEFIK_DIR"
if [ ! -f "${TRAEFIK_DIR}/acme.json" ]; then
  touch "${TRAEFIK_DIR}/acme.json"
  chmod 600 "${TRAEFIK_DIR}/acme.json"
  echo "   ✅ Traefik ACME storage file created"
fi

# --- Ensure Authentik blueprints directory exists and copy from source control ---
mkdir -p ./volumes/authentik/blueprints
cp ./authentik/blueprints/homelab.yaml ./volumes/authentik/blueprints/homelab.yaml

# --- Ensure Apprise directory exists ---
echo "💬 Setting up Apprise alert gateway..."
mkdir -p ./volumes/apprise/config






# Copy example-data/* to data/ if it doesn't already exist
EXAMPLE_DATA="./uptime-kuma/example-data/"
TARGET_DATA="./volumes/uptime-kuma/data/"

if [ ! -d "$TARGET_DATA" ]; then
  echo "   Setting up Uptime Kuma database..."
  mkdir -p "$TARGET_DATA"
  cp -r "$EXAMPLE_DATA"/. "$TARGET_DATA"
  echo "   ✅ Uptime Kuma database initialized"
else
  echo "   ✅ Uptime Kuma database already exists"
fi

# Copy all files from ./dockge/example-data to ./volumes/dockge/data
EXAMPLE_DATA="./dockge/example-data/"
TARGET_DATA="./volumes/dockge/data/"

if [ ! -d "$TARGET_DATA" ]; then
  echo "   Setting up Dockge database..."
  mkdir -p "$TARGET_DATA"
  cp -r "$EXAMPLE_DATA"/. "$TARGET_DATA"
  echo "   ✅ Dockge database initialized"
else
  echo "   ✅ Dockge database already exists"
fi

# --- SSL Certificate generation ---
# Ensure placeholder CA cert file exists so Docker doesn't create it as a directory when mounting.
# This is needed for services like vaultwarden and uptime-kuma in both Let's Encrypt and self-signed modes.
if [ ! -f "$CA_CERT_OUT" ]; then
  touch "$CA_CERT_OUT"
  chmod 644 "$CA_CERT_OUT"
fi

# In Let's Encrypt mode Traefik handles certificates automatically; skip OpenSSL.
if [ "${TRAEFIK_CERT_RESOLVER}" = "letsencrypt" ]; then
  echo "   ✅ Let's Encrypt mode — Traefik will obtain certificates automatically"
  echo "   ℹ️  Make sure CF_DNS_API_TOKEN is set correctly in .env"

  # Traefik dynamic config references a default TLS certificate for fallback.
  # Ensure it exists even when ACME/Let's Encrypt mode is used.
  if [ ! -s "$FALLBACK_CERT_OUT" ] || [ ! -s "$FALLBACK_KEY_OUT" ]; then
    echo "   Generating fallback Traefik TLS certificate..."
    openssl req -x509 -newkey rsa:2048 -sha256 -days 365 -nodes \
      -keyout "$FALLBACK_KEY_OUT" \
      -out "$FALLBACK_CERT_OUT" \
      -subj "/CN=${HOMELAB_HOSTNAME}" >/dev/null 2>&1
    chmod 600 "$FALLBACK_KEY_OUT"
    chmod 644 "$FALLBACK_CERT_OUT"
    echo "   ✅ Fallback Traefik TLS certificate ready"
  fi
else
  # Create Certificate Authority if needed
  if [ ! -f "$CA_KEY_OUT" ] || [ ! -f "$CA_CERT_OUT" ]; then
      echo "   Creating Certificate Authority..."

      # Generate the CA's private key
      sudo openssl genrsa -out "${CA_KEY_OUT}" "${KEY_BITS}"

      # Compute CA subject: prefer HOMELAB_USERNAME (from .env), then USERNAME (interactive), then system user
      CA_SUBJECT="${HOMELAB_USERNAME} Homelab CA"

      # Generate the CA's self-signed root certificate using the computed subject
      sudo openssl req -x509 -new -nodes -key "${CA_KEY_OUT}" -sha256 -days "${CERT_DAYS}" \
          -out "${CA_CERT_OUT}" \
          -subj "/CN=${CA_SUBJECT}"
      
      echo "   ✅ Certificate Authority created"
      echo "   ⚠️  Remember to add CA certificate to your devices' trust stores"
  else
      echo "   ✅ Certificate Authority already exists"
  fi

  # Generate server certificate
  echo "   Generating server certificate..."
  cat <<EOF > "$CONF_FILE"
[req]
default_bits = ${KEY_BITS}
prompt = no
default_md = sha256
distinguished_name = dn
req_extensions = v3_req

[dn]
CN = ${COMMON_NAME}

[v3_req]
subjectAltName = @alt_names

[alt_names]
EOF

  # Dynamically add SAN domains to the config file
  for i in "${!SAN_DOMAINS[@]}"; do
      echo "DNS.$((i+1)) = ${SAN_DOMAINS[$i]}" >> "$CONF_FILE"
  done

  # Generate server private key and certificate
  sudo openssl genrsa -out "${KEY_OUT}" "${KEY_BITS}"
  sudo openssl req -new -key "${KEY_OUT}" -out "${CSR_OUT}" -config "${CONF_FILE}"
  sudo openssl x509 -req -in "${CSR_OUT}" \
      -CA "${CA_CERT_OUT}" -CAkey "${CA_KEY_OUT}" -CAcreateserial \
      -out "${CERT_OUT}" -days "${CERT_DAYS}" -sha256 \
      -extfile "${CONF_FILE}" -extensions v3_req

  # Set secure permissions
  sudo chmod 644 "${KEY_OUT}"
  sudo chmod 644 "${CA_KEY_OUT}"

  # Create stable-named copies for Traefik's dynamic_conf.yml
  sudo cp "${CERT_OUT}" "${FALLBACK_CERT_OUT}"
  sudo cp "${KEY_OUT}" "${FALLBACK_KEY_OUT}"

  # Try to install CA in system trust store
  if [ -f "${CA_CERT_OUT}" ]; then
      if [ -d /etc/ca-certificates/trust-source/anchors ] && command -v trust >/dev/null 2>&1; then
          sudo cp "${CA_CERT_OUT}" /etc/ca-certificates/trust-source/anchors/ && sudo trust extract-compat >/dev/null 2>&1 || true
      elif command -v update-ca-certificates >/dev/null 2>&1; then
          dest="/usr/local/share/ca-certificates/$(basename "${CA_CERT_OUT}")"
          sudo cp "${CA_CERT_OUT}" "${dest}" && sudo update-ca-certificates >/dev/null 2>&1 || true
      elif [ -d /etc/pki/ca-trust/source/anchors ] && command -v update-ca-trust >/dev/null 2>&1; then
          sudo cp "${CA_CERT_OUT}" /etc/pki/ca-trust/source/anchors/ && sudo update-ca-trust extract >/dev/null 2>&1 || true
      elif [ "$(uname)" = "Darwin" ] && command -v security >/dev/null 2>&1; then
          sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain "${CA_CERT_OUT}" >/dev/null 2>&1 || true
      fi
  fi

  echo "   ✅ SSL certificates ready"

  # --- Clean up temporary files ---
  sudo rm "$CONF_FILE"
  sudo rm "$CSR_OUT"
fi


echo ""
echo ""
echo "🐳 Starting Docker containers..."
chmod +x ./homelab-dashboard/api/entrypoint.sh
docker network create homelab-net --subnet 10.10.30.0/24 || true
touch ./volumes/secrets/matrix_bot_token
docker compose build
docker compose up -d

echo "   Waiting 9 seconds for services to initialize..."
sleep 1
echo "   Waiting 8 seconds for services to initialize..."
sleep 1
echo "   Waiting 7 seconds for services to initialize..."
sleep 1
echo "   Waiting 6 seconds for services to initialize..."
sleep 1
echo "   Waiting 5 seconds for services to initialize..."
sleep 1
echo "   Waiting 4 seconds for services to initialize..."
sleep 1
echo "   Waiting 3 seconds for services to initialize..."
sleep 1
echo "   Waiting 2 seconds for services to initialize..."
sleep 1
echo "   Waiting 1 second for services to initialize..."
sleep 1
echo "✅ Docker containers started"



echo ""
echo "⚙️  Configuring Portainer..."
PORTAINER_ADMIN_PASSWORD=$(cat ./volumes/secrets/portainer_admin_password)
ADMIN_EXISTS=$(docker exec portainer curl -s -k -o /dev/null -w "%{http_code}" "http://localhost:9000/api/users/admin/check" 2>/dev/null || echo "404")

if [ "$ADMIN_EXISTS" -eq 404 ]; then
  echo "   Extracting setup token..."
  SETUP_TOKEN=""
  for i in {1..30}; do
    SETUP_TOKEN=$(docker logs portainer 2>&1 | grep "setup_token" | awk -F 'setup_token=' '{print $2}' | sed 's/\x1b\[[0-9;]*m//g' | tr -d '\r\n')
    if [ -n "$SETUP_TOKEN" ]; then
      break
    fi
    sleep 1
  done

  if [ -z "$SETUP_TOKEN" ]; then
    echo "   ❌ Failed to extract Portainer setup token from logs"
    exit 1
  fi

  echo "   Initializing admin user..."
  docker exec portainer curl -s -k -X POST \
    -H "Content-Type: application/json" \
    -H "X-Setup-Token: ${SETUP_TOKEN}" \
    -d "{\"username\": \"admin\", \"password\": \"${PORTAINER_ADMIN_PASSWORD}\"}" \
    "http://localhost:9000/api/users/admin/init" >/dev/null 2>&1
else
  echo "   Admin user already initialized."
fi

echo "   Getting authentication token..."
TOKEN=$(docker exec portainer curl -s -k -X POST \
  -H "Content-Type: application/json" \
  -d "{\"username\": \"admin\", \"password\": \"${PORTAINER_ADMIN_PASSWORD}\"}" \
  "http://localhost:9000/api/auth" | jq -r .jwt)

if [ -z "$TOKEN" ] || [ "$TOKEN" == "null" ]; then
  echo "   ❌ Failed to authenticate with Portainer"
  exit 1
fi

echo "   Configuring SSO settings..."
RESPONSE=$(docker exec -i portainer curl -s -k -w "\n%{http_code}" -X PUT \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  --data-binary @- \
  "http://localhost:9000/api/settings" << EOF
{
  "authenticationMethod": 3,
  "oauthSettings": {
    "SSO": true,
    "OAuthAutoCreateUsers": true,
    "ClientID": "portainer",
    "ClientSecret": "${PORTAINER_OIDC_SECRET}",
    "AccessTokenURI": "https://${AUTHENTIK_WEB_HOSTNAME}/application/o/token/",
    "AuthorizationURI": "https://${AUTHENTIK_WEB_HOSTNAME}/application/o/authorize/",
    "ResourceURI": "https://${AUTHENTIK_WEB_HOSTNAME}/application/o/userinfo/",
    "RedirectURI": "https://${PORTAINER_WEB_HOSTNAME}",
    "LogoutURI": "https://${AUTHENTIK_WEB_HOSTNAME}/application/o/portainer/end-session/",
    "UserIdentifier": "preferred_username",
    "Scopes": "openid profile email groups"
  }
}
EOF
)

# Check result
STATUS_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$STATUS_CODE" -eq 200 ]; then
  echo "   ✅ Portainer SSO configured"
else
  echo "   ❌ Failed to configure Portainer SSO (HTTP: ${STATUS_CODE})"
  exit 1
fi

dashboard_curl() {
  local path="$1"
  local data="$2"
  local url="http://127.0.0.1:5000$path"

  local output
  output=$(docker exec homelab-dashboard wget -qO- \
    --server-response \
    --header="Content-Type: application/json" \
    --post-data="$data" \
    "$url" 2>&1)

  # Body = everything up to last blank line
  local body=$(echo "$output" | sed -n '/^\r\{0,1\}$/,$!p')

  # Status code = last "HTTP/1.1 XXX" line
  local status_code=$(echo "$output" | grep -o "HTTP/1.[01] [0-9]*" | tail -n1 | awk '{print $2}')

  echo "$body"
  echo "$status_code"
}


# --- MAIN FUNCTION ---
# Performs a login and checks if it was successful.
dashboard_login() {
  local username="$1"
  local password="$2"

  # Construct the JSON data for the login request
  local login_data=$(jq -n --arg u "$username" --arg p "$password" '{username: $u, password: $p}')

  # Call the curl function and capture the output
  local output=$(dashboard_curl "/api/users/login" "$login_data")

  # The status code is the last line of the output
  local http_code=$(echo "$output" | tail -n1)

  # Check if the HTTP status code is 200 (OK)
  if [ "$http_code" = "200" ]; then
    echo "   ✅ Login successful!"
  else
    echo "   ❌ Login failed. Server responded with HTTP status code: $http_code"
  fi
}


# --- SCRIPT EXECUTION ---
echo ""
echo "🏠 Configuring Homelab Dashboard..."
echo "   Initializing admin user..."
# This is how you call the function
dashboard_login "${HOMELAB_USERNAME}" "${HOMELAB_PASSWORD}"

echo ""
echo "🔔 Setting up Gotify server & Apprise yaml integration..."

# Wait for Gotify container to be healthy
echo "   Waiting for Gotify to initialize..."
for i in {1..60}; do
  if curl -s http://localhost:8083/version >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

if curl -s http://localhost:8083/version >/dev/null 2>&1; then
  echo "   Gotify is up. Configuring..."
  GOTIFY_PASS=$(cat ./volumes/secrets/gotify_admin_password)

  # 1. Update the default admin password from admin to gotify_admin_password
  curl -s -X POST -u admin:admin -H "Content-Type: application/json" \
    -d "{\"pass\":\"$GOTIFY_PASS\"}" \
    "http://localhost:8083/current/user/password" >/dev/null

  # 2. Check if the default application for Apprise already exists
  APPS_LIST=$(curl -s -X GET -u "admin:$GOTIFY_PASS" "http://localhost:8083/application")
  GOTIFY_TOKEN_AND_ID=$(echo "$APPS_LIST" | python3 -c '
import sys, json
try:
    apps = json.load(sys.stdin)
    if isinstance(apps, list):
        for app in apps:
            if app.get("name") == "Homelab Alert Gateway":
                print(app.get("token"), app.get("id"))
                break
except Exception:
    pass
' 2>/dev/null)
  read -r GOTIFY_TOKEN GOTIFY_ID <<< "$GOTIFY_TOKEN_AND_ID" || true

  if [ -z "$GOTIFY_TOKEN" ]; then
    # Create the default application for Apprise
    APP_RES=$(curl -s -X POST -u "admin:$GOTIFY_PASS" -H "Content-Type: application/json" \
      -d '{"name":"Homelab Alert Gateway","description":"Gateway for all homelab services"}' \
      "http://localhost:8083/application")

    # Extract the token and ID using python3
    GOTIFY_TOKEN_AND_ID=$(echo "$APP_RES" | python3 -c '
import sys, json
try:
    app = json.load(sys.stdin)
    print(app.get("token"), app.get("id"))
except Exception:
    pass
' 2>/dev/null)
    read -r GOTIFY_TOKEN GOTIFY_ID <<< "$GOTIFY_TOKEN_AND_ID" || true
  fi

  if [ -n "$GOTIFY_TOKEN" ]; then
    echo "   ✅ Created Gotify Application. Token generated."

    # Upload application icon
    if [ -f "./gotify/homelab-icon.png" ] && [ -n "$GOTIFY_ID" ]; then
      curl -s -X POST -u "admin:$GOTIFY_PASS" \
        -F "file=@./gotify/homelab-icon.png" \
        "http://localhost:8083/application/${GOTIFY_ID}/image" >/dev/null
      echo "   ✅ Uploaded Gotify Application icon."
    fi
    
    # 3. Copy and substitute template apprise.yaml
    mkdir -p ./volumes/apprise/config
    sed -e "s|GOTIFY_TOKEN|${GOTIFY_TOKEN}|g" \
        ./apprise/apprise.yaml > ./volumes/apprise/config/apprise.yaml
    echo "   ✅ Generated apprise.yaml configuration"
    
    # Restart apprise-api to apply changes
    docker restart apprise-api >/dev/null
    echo "   ✅ SMTP/HTTP notification gateway reloaded"
  else
    echo "   ❌ Failed to create Gotify application token"
  fi
else
  echo "   ❌ Gotify was not healthy, skipping configuration"
fi

echo ""
echo "🎉 Homelab Setup Complete!"
echo "=========================="
echo ""
echo "📋 Access Information:"
echo "   Username: ${HOMELAB_USERNAME}"
echo "   Email:    ${HOMELAB_USERNAME}@${HOMELAB_HOSTNAME}"
echo ""

# Extract RustDesk public key for the dashboard if the container is running
if [ "$(docker ps -q -f name=rustdesk-id-server)" ]; then
  echo "🖥️  Extracting RustDesk Public Key to secrets..."
  mkdir -p "${PROJECT_ROOT}/volumes/secrets"
  docker cp rustdesk-id-server:/root/id_ed25519.pub "${PROJECT_ROOT}/volumes/secrets/rustdesk_public_key"
  echo "   ✅ RustDesk Public Key extracted to volumes/secrets/rustdesk_public_key"
  echo ""
fi


echo "🌐 Web Access:"
echo "   Dashboard:  https://${DASHBOARD_WEB_HOSTNAME:-dashboard.${HOMELAB_HOSTNAME}}"
echo "   Gotify:     https://${GOTIFY_WEB_HOSTNAME:-gotify.${HOMELAB_HOSTNAME}} (User: admin / Pass: $(cat ./volumes/secrets/gotify_admin_password))"
echo "   Portainer:  https://${PORTAINER_WEB_HOSTNAME:-portainer.${HOMELAB_HOSTNAME}} (Fallback User: admin / Pass: $(cat ./volumes/secrets/portainer_admin_password))"
echo "   Auth:       https://${AUTHENTIK_WEB_HOSTNAME:-auth.${HOMELAB_HOSTNAME}}"
echo "   Vault:      https://${VAULTWARDEN_WEB_HOSTNAME:-vaultwarden.${HOMELAB_HOSTNAME}}"
echo ""
if [ "${TRAEFIK_CERT_RESOLVER}" = "letsencrypt" ]; then
  echo "🔒 SSL Mode: Let's Encrypt (Cloudflare DNS-01)"
  echo "   Traefik will automatically obtain and renew certificates."
else
  echo "🔒 SSL Mode: Self-signed (private)"
  echo "⚠️  Remember to add the CA certificate to your devices' trust stores!"
  echo "   CA Certificate: ${CA_CERT_OUT}"
fi