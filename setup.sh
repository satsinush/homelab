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
  read -p "   Username: " USERNAME

  while true; do
    read -p "   Password (min 12 characters): " PASSWORD
    echo

    if [ ${#PASSWORD} -lt 12 ]; then
      echo "   ⚠️  Password is too short. Please try again."
    else
      break
    fi
  done

  echo "   Generating security tokens..."
  # Generate bcrypt password
  BCRYPT_PASSWORD=$(htpasswd -nbBC 10 "" "$PASSWORD" | tr -d ':' )

  # Generate the ntfy token using the ntfy docker image (assumes docker is installed)
  NTFY_TOKEN=$(docker run --rm binwiederhier/ntfy:latest token generate | tr -d '\r\n')

  # Create the new .env file
  cp "$TEMPLATE_FILE" "$OUTPUT_FILE"

  # Generate secrets for replacement
  HOMELAB_API_SESSION_SECRET=$(openssl rand -hex 64)
  VAULTWARDEN_ADMIN_TOKEN=$(openssl rand -hex 64)
  VAULTWARDEN_OIDC_SECRET=$(openssl rand -hex 64)
  PORTAINER_OIDC_SECRET=$(openssl rand -hex 64)
  DASHBOARD_OIDC_SECRET=$(openssl rand -hex 64)
  LLDAP_JWT_SECRET=$(openssl rand -hex 64)
  LLDAP_LDAP_USER_PASS=$(openssl rand -hex 16)
  AUTHELIA_JWT_SECRET=$(openssl rand -hex 64)
  AUTHELIA_SESSION_SECRET=$(openssl rand -hex 64)
  AUTHELIA_STORAGE_ENCRYPTION_KEY=$(openssl rand -hex 64)
  AUTHELIA_HMAC_SECRET=$(openssl rand -hex 64)

  echo "   Hashing OIDC secrets..."
  # Generate Argon2 hashed secrets for Authelia OIDC clients
  VAULTWARDEN_OIDC_HASHED=$(docker run --rm authelia/authelia:latest authelia crypto hash generate argon2 --password "$VAULTWARDEN_OIDC_SECRET" | awk '{print $2}')
  PORTAINER_OIDC_HASHED=$(docker run --rm authelia/authelia:latest authelia crypto hash generate argon2 --password "$PORTAINER_OIDC_SECRET" | awk '{print $2}')
  DASHBOARD_OIDC_HASHED=$(docker run --rm authelia/authelia:latest authelia crypto hash generate argon2 --password "$DASHBOARD_OIDC_SECRET" | awk '{print $2}')

  # Replace placeholders in the new .env file using specific placeholder names
  sed -i "s|<HOMELAB_API_SESSION_SECRET>|$HOMELAB_API_SESSION_SECRET|g" "$OUTPUT_FILE"
  sed -i "s|<VAULTWARDEN_ADMIN_TOKEN>|$VAULTWARDEN_ADMIN_TOKEN|g" "$OUTPUT_FILE"
  sed -i "s|<VAULTWARDEN_OIDC_SECRET>|$VAULTWARDEN_OIDC_SECRET|g" "$OUTPUT_FILE"
  sed -i "s|<VAULTWARDEN_OIDC_HASHED_SECRET>|$VAULTWARDEN_OIDC_HASHED|g" "$OUTPUT_FILE"
  sed -i "s|<PORTAINER_OIDC_SECRET>|$PORTAINER_OIDC_SECRET|g" "$OUTPUT_FILE"
  sed -i "s|<PORTAINER_OIDC_HASHED_SECRET>|$PORTAINER_OIDC_HASHED|g" "$OUTPUT_FILE"
  sed -i "s|<DASHBOARD_OIDC_SECRET>|$DASHBOARD_OIDC_SECRET|g" "$OUTPUT_FILE"
  sed -i "s|<DASHBOARD_OIDC_HASHED_SECRET>|$DASHBOARD_OIDC_HASHED|g" "$OUTPUT_FILE"
  sed -i "s|<LLDAP_JWT_SECRET>|$LLDAP_JWT_SECRET|g" "$OUTPUT_FILE"
  sed -i "s|<LLDAP_LDAP_USER_PASS>|$LLDAP_LDAP_USER_PASS|g" "$OUTPUT_FILE"
  sed -i "s|<AUTHELIA_JWT_SECRET>|$AUTHELIA_JWT_SECRET|g" "$OUTPUT_FILE"
  sed -i "s|<AUTHELIA_SESSION_SECRET>|$AUTHELIA_SESSION_SECRET|g" "$OUTPUT_FILE"
  sed -i "s|<AUTHELIA_STORAGE_ENCRYPTION_KEY>|$AUTHELIA_STORAGE_ENCRYPTION_KEY|g" "$OUTPUT_FILE"
  sed -i "s|<AUTHELIA_HMAC_SECRET>|$AUTHELIA_HMAC_SECRET|g" "$OUTPUT_FILE"
  sed -i "s|<ntfy-encoded-password>|$BCRYPT_PASSWORD|g" "$OUTPUT_FILE"
  sed -i "s|<username>|$USERNAME|g" "$OUTPUT_FILE"
  sed -i "s|<password>|$PASSWORD|g" "$OUTPUT_FILE"
  sed -i "s|<ntfy-token>|$NTFY_TOKEN|g" "$OUTPUT_FILE"

  echo "✅ Environment configuration created"
else
  echo "✅ Environment configuration already exists"
fi

# Load environment variables from the .env file
if [ -f .env ]; then
  export $(grep -v '^#' .env | sed 's/\r$//' | xargs)
fi

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
CSR_OUT="/tmp/${HOMELAB_HOSTNAME}.csr"
CONF_FILE="/tmp/server_ssl_config.cnf"

# --- Certificate Details ---
COUNTRY="US"
STATE="Wisconsin"
CITY="Appleton"
ORGANIZATION="aneedham"
OU_NAME="homelab"
COMMON_NAME="${HOMELAB_HOSTNAME}"

# List all Subject Alternative Names (SANs) for the server certificate.
declare -a SAN_DOMAINS=(
    "${HOMELAB_HOSTNAME}"
    "${DASHBOARD_WEB_HOSTNAME}"
    "${PIHOLE_WEB_HOSTNAME}"
    "${NETDATA_WEB_HOSTNAME}"
    "${PORTAINER_WEB_HOSTNAME}"
    "${VAULTWARDEN_WEB_HOSTNAME}"
    "${UPTIME_KUMA_WEB_HOSTNAME}"
    "${NTFY_WEB_HOSTNAME}"
    "${AUTHELIA_WEB_HOSTNAME}"
    "${LLDAP_WEB_HOSTNAME}"
)

# --- Ensure SSL directory exists ---
mkdir -p "$CERTS_DIR"

# --- Ensure Authelia private key exists ---
AUTHELIA_DIR="./volumes/authelia"
AUTHELIA_KEY="${AUTHELIA_DIR}/private.pem"
mkdir -p "$AUTHELIA_DIR"
if [ ! -f "${AUTHELIA_KEY}" ]; then
  echo "   Generating Authelia private key..."
  touch "${AUTHELIA_KEY}"
  sudo openssl genrsa -out "${AUTHELIA_KEY}" 4096
  sudo chmod 600 "${AUTHELIA_KEY}"
  echo "   ✅ Authelia key created"
else
  echo "   ✅ Authelia key already exists"
fi

# Copy example-data/kuma.db to data/kuma.db if it doesn't already exist
EXAMPLE_DB="./uptime-kuma/example-data/kuma.db"
TARGET_DB="./volumes/uptime-kuma/data/kuma.db"

if [ ! -f "$TARGET_DB" ]; then
  echo "   Setting up Uptime Kuma database..."
  mkdir -p "$(dirname "$TARGET_DB")"
  cp "$EXAMPLE_DB" "$TARGET_DB"
  echo "   ✅ Uptime Kuma database initialized"
else
  echo "   ✅ Uptime Kuma database already exists"
fi

# Create Certificate Authority if needed
if [ ! -f "$CA_KEY_OUT" ] || [ ! -f "$CA_CERT_OUT" ]; then
    echo "   Creating Certificate Authority..."

    # Generate the CA's private key
    sudo openssl genrsa -out "${CA_KEY_OUT}" "${KEY_BITS}"

    # Generate the CA's self-signed root certificate
    sudo openssl req -x509 -new -nodes -key "${CA_KEY_OUT}" -sha256 -days "${CERT_DAYS}" \
        -out "${CA_CERT_OUT}" \
        -subj "/C=${COUNTRY}/ST=${STATE}/O=${ORGANIZATION}/CN=${ORGANIZATION} Homelab CA"
    
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
C = ${COUNTRY}
ST = ${STATE}
L = ${CITY}
O = ${ORGANIZATION}
OU = ${OU_NAME}
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
sudo chmod 600 "${KEY_OUT}"
sudo chmod 600 "${CA_KEY_OUT}"

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


echo ""
echo "🐳 Starting Docker containers..."
docker-compose up -d --build

echo "   Waiting 10 seconds for services to initialize..."
sleep 10
echo "✅ Docker containers started"

echo ""
echo "👥 Setting up LLDAP users and groups..."

# Function to get LLDAP JWT token
get_lldap_token() {
    local response=$(docker exec lldap curl -s -X POST \
        -H "Content-Type: application/json" \
        -d "{\"username\": \"admin\", \"password\": \"${LLDAP_LDAP_USER_PASS}\"}" \
        "http://localhost:17170/auth/simple/login" 2>/dev/null)
    
    if [ $? -eq 0 ] && [ ! -z "$response" ]; then
        echo "$response" | jq -r '.token' 2>/dev/null
    else
        echo ""
    fi
}

# Function to check if group exists
group_exists() {
    local group_name="$1"
    local token="$2"
    
    local query='{"query":"query { groups { displayName } }"}'
    local response=$(docker exec lldap curl -s -X POST \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $token" \
        -d "$query" \
        "http://localhost:17170/api/graphql" 2>/dev/null)
    
    if echo "$response" | jq -r '.data.groups[].displayName' 2>/dev/null | grep -q "^${group_name}$"; then
        return 0  # Group exists
    else
        return 1  # Group doesn't exist
    fi
}

# Function to check if user exists
user_exists() {
    local username="$1"
    local token="$2"
    
    local query='{"query":"query { users { id } }"}'
    local response=$(docker exec lldap curl -s -X POST \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $token" \
        -d "$query" \
        "http://localhost:17170/api/graphql" 2>/dev/null)
    
    if echo "$response" | jq -r '.data.users[].id' 2>/dev/null | grep -q "^${username}$"; then
        return 0  # User exists
    else
        return 1  # User doesn't exist
    fi
}

# Function to check if user is in group
user_in_group() {
    local username="$1"
    local group_name="$2"
    local token="$3"
    
    local group_id=$(get_group_id "$group_name" "$token")
    if [ -z "$group_id" ] || [ "$group_id" = "null" ]; then
        return 1  # Group doesn't exist
    fi
    
    local query='{"query":"query { user(userId: \"'$username'\") { groups { id } } }"}'
    local response=$(docker exec lldap curl -s -X POST \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $token" \
        -d "$query" \
        "http://localhost:17170/api/graphql" 2>/dev/null)
    
    if echo "$response" | jq -r '.data.user.groups[].id' 2>/dev/null | grep -q "^${group_id}$"; then
        return 0  # User is in group
    else
        return 1  # User is not in group
    fi
}

# Function to create LLDAP group (GraphQL)
create_lldap_group() {
    local group_name="$1"
    local display_name="$2"
    local token="$3"
    
    # Check if group already exists
    if group_exists "$display_name" "$token"; then
        echo "     ✅ Group $group_name already exists"
        return 0
    fi
    
    echo "     Creating group: $group_name"
    local query='{"query":"mutation { createGroup(name: \"'$display_name'\") { id displayName } }"}'
    local response=$(docker exec lldap curl -s -w "\nHTTP_CODE:%{http_code}" -X POST \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $token" \
        -d "$query" \
        "http://localhost:17170/api/graphql")
    
    local http_code=$(echo "$response" | grep "HTTP_CODE:" | cut -d: -f2)
    local body=$(echo "$response" | sed '/HTTP_CODE:/d')
    
    if [ "$http_code" = "200" ]; then
        local group_id=$(echo "$body" | jq -r '.data.createGroup.id' 2>/dev/null)
        if [ "$group_id" != "null" ] && [ ! -z "$group_id" ]; then
            echo "     ✅ Group $group_name created"
        else
            echo "     ❌ Failed to create group $group_name"
        fi
    else
        echo "     ❌ Failed to create group $group_name (HTTP: $http_code)"
    fi
}

# Function to create LLDAP user (GraphQL)
create_lldap_user() {
    local username="$1"
    local email="$2"
    local display_name="$3"
    local password="$4"
    local token="$5"
    
    # Check if user already exists
    if user_exists "$username" "$token"; then
        echo "     ✅ User $username already exists"
        # Still try to update password for existing user
        set_user_password "$username" "$password" "$token" >/dev/null 2>&1
        return 0
    fi
    
    echo "     Creating user: $username"
    local query='{"query":"mutation { createUser(user: { id: \"'$username'\", email: \"'$email'\", displayName: \"'$display_name'\" }) { id displayName } }"}'
    local response=$(docker exec lldap curl -s -w "\nHTTP_CODE:%{http_code}" -X POST \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $token" \
        -d "$query" \
        "http://localhost:17170/api/graphql")
    
    local http_code=$(echo "$response" | grep "HTTP_CODE:" | cut -d: -f2)
    local body=$(echo "$response" | sed '/HTTP_CODE:/d')
    
    if [ "$http_code" = "200" ]; then
        local user_id=$(echo "$body" | jq -r '.data.createUser.id' 2>/dev/null)
        if [ "$user_id" != "null" ] && [ ! -z "$user_id" ]; then
            echo "     ✅ User $username created"
            # Set password for the user
            set_user_password "$username" "$password" "$token" >/dev/null 2>&1
        else
            echo "     ❌ Failed to create user $username"
        fi
    else
        echo "     ❌ Failed to create user $username (HTTP: $http_code)"
    fi
}

# Function to set user password using the correct LLDAP tool
set_user_password() {
  local username="$1"
  local password="$2"
  local token="$3"

  echo "    Setting password for user: $username"

  # Prefer token if provided and not "null"
  local use_token=0
  if [ -n "$token" ] && [ "$token" != "null" ]; then
    use_token=1
  fi

  if [ $use_token -eq 1 ]; then
    echo "    Using token to authenticate to lldap_set_password..."
    local cli_result
    cli_result=$(docker exec lldap /app/lldap_set_password \
      --base-url "http://localhost:17170" \
      --username "$username" \
      --password "$password" \
      --token "$token" 2>&1)
    local cli_exit_code=$?
  else
    echo "    Token not available, falling back to admin password authentication..."
    if [ -z "${LLDAP_LDAP_USER_PASS:-}" ]; then
      echo "    ❌ Admin password not configured (LLDAP_LDAP_USER_PASS is empty). Cannot set password."
      return 1
    fi
    local cli_result
    cli_result=$(docker exec lldap /app/lldap_set_password \
      --base-url "http://localhost:17170" \
      --username "$username" \
      --password "$password" \
      --admin-password "$LLDAP_LDAP_USER_PASS" 2>&1)
    local cli_exit_code=$?
  fi

  if [ "$cli_exit_code" -eq 0 ]; then
    echo "    ✅ Password set successfully"
    return 0
  else
    echo "    ❌ Failed to set password"
    echo "    Error: $cli_result"
    echo ""
    echo "    ⚠️  Password must be set manually in LLDAP web interface:"
    echo "       1. Open: https://${LLDAP_WEB_HOSTNAME}"
    echo "       2. Login as: admin / ${LLDAP_LDAP_USER_PASS}"
    echo "       3. Navigate to Users section"
    echo "       4. Edit user: $username"
    echo "       5. Set password to: $password"
    echo "       6. Save changes"
    return 1
  fi
}

# Function to get group ID by name
get_group_id() {
    local group_name="$1"
    local token="$2"
    
    local query='{"query":"query { groups { id displayName } }"}'
    local response=$(docker exec lldap curl -s -X POST \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $token" \
        -d "$query" \
        "http://localhost:17170/api/graphql" 2>/dev/null)
    
    echo "$response" | jq -r ".data.groups[] | select(.displayName == \"$group_name\") | .id" 2>/dev/null
}

# Function to add user to group (GraphQL)
add_user_to_group() {
    local username="$1"
    local group_name="$2"
    local token="$3"
    
    echo "     Adding $username to group: $group_name"
    
    # Check if user is already in the group
    if user_in_group "$username" "$group_name" "$token"; then
        echo "     ✅ $username already in $group_name"
        return 0
    fi
    
    # Get group ID first
    local group_id=$(get_group_id "$group_name" "$token")
    if [ -z "$group_id" ] || [ "$group_id" = "null" ]; then
        echo "     ❌ Could not find group $group_name"
        return
    fi
    
    local query='{"query":"mutation { addUserToGroup(userId: \"'$username'\", groupId: '$group_id') { ok } }"}'
    local response=$(docker exec lldap curl -s -w "\nHTTP_CODE:%{http_code}" -X POST \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $token" \
        -d "$query" \
        "http://localhost:17170/api/graphql")
    
    local http_code=$(echo "$response" | grep "HTTP_CODE:" | cut -d: -f2)
    local body=$(echo "$response" | sed '/HTTP_CODE:/d')
    
    if [ "$http_code" = "200" ]; then
        local success=$(echo "$body" | jq -r '.data.addUserToGroup.ok' 2>/dev/null)
        if [ "$success" = "true" ]; then
            echo "     ✅ Added $username to $group_name"
        else
            echo "     ❌ Failed to add $username to $group_name"
        fi
    else
        echo "     ❌ Failed to add $username to $group_name (HTTP: $http_code)"
    fi
}

# Retry mechanism for getting token
echo "   Authenticating with LLDAP..."
for i in {1..5}; do
    TOKEN=$(get_lldap_token)
    if [ ! -z "$TOKEN" ] && [ "$TOKEN" != "null" ]; then
        echo "   ✅ LLDAP authentication successful"
        break
    else
        echo "   ⏳ Attempt $i/5: Waiting for LLDAP to be ready..."
        sleep 10
    fi
done

if [ -z "$TOKEN" ] || [ "$TOKEN" == "null" ]; then
    echo "   ❌ Failed to authenticate with LLDAP after 5 attempts"
    echo "   ⚠️  You'll need to manually create users and groups in LLDAP web interface"
    echo "      Default login: admin / ${LLDAP_PASSWORD}"
else
    echo "   Creating LLDAP groups..."
    
    # Create required groups - simplified to just two groups
    create_lldap_group "homelab_admins" "homelab_admins" "$TOKEN"
    create_lldap_group "homelab_users" "homelab_users" "$TOKEN"
    
    echo "👤 Creating personal user account..."
    
    # Create your personal user account
    create_lldap_user "$LLDAP_USERNAME" \
                      "$LLDAP_USERNAME@$DNS_DOMAIN" \
                      "$LLDAP_USERNAME" \
                      "$LLDAP_PASSWORD" \
                      "$TOKEN"
    
    echo "   Adding user to admin groups..."
    
    # Add user to admin groups (using display names since that's what we need to look up)
    add_user_to_group "$LLDAP_USERNAME" "lldap_admin" "$TOKEN"
    add_user_to_group "$LLDAP_USERNAME" "homelab_admins" "$TOKEN"
    
    echo "   ✅ LLDAP setup complete"
fi

echo ""
echo "⚙️  Configuring Portainer..."
echo "   Initializing admin user..."
docker exec portainer curl -s -k -X POST \
  -H "Content-Type: application/json" \
  -d "{\"username\": \"${PORTAINER_ADMIN_USERNAME}\", \"password\": \"${PORTAINER_ADMIN_PASSWORD}\"}" \
  "http://localhost:9000/api/users/admin/init" >/dev/null 2>&1

echo "   Getting authentication token..."
TOKEN=$(docker exec portainer curl -s -k -X POST \
  -H "Content-Type: application/json" \
  -d "{\"username\": \"${PORTAINER_ADMIN_USERNAME}\", \"password\": \"${PORTAINER_ADMIN_PASSWORD}\"}" \
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
    "AccessTokenURI": "https://${AUTHELIA_WEB_HOSTNAME}/api/oidc/token",
    "AuthorizationURI": "https://${AUTHELIA_WEB_HOSTNAME}/api/oidc/authorization",
    "ResourceURI": "https://${AUTHELIA_WEB_HOSTNAME}/api/oidc/userinfo",
    "RedirectURI": "https://${PORTAINER_WEB_HOSTNAME}",
    "LogoutURI": "https://${AUTHELIA_WEB_HOSTNAME}/logout",
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

echo ""
echo "🎉 Homelab Setup Complete!"
echo "=========================="
echo ""
echo "📋 Access Information:"
echo "   Username: ${LLDAP_USERNAME}"
echo "   Password: ${LLDAP_PASSWORD}"
echo ""

# Print RustDesk public key if available
RUSTDESK_PUB="./rustdesk/data/id_ed25519.pub"
if [ -f "${RUSTDESK_PUB}" ]; then
  echo "🖥️ RustDesk Public Key:"
  cat "${RUSTDESK_PUB}"
  echo ""
fi

# Print ntfy token if available
if [ ! -z "${NTFY_TOKEN}" ]; then
  echo "📱 Ntfy Token:"
  echo "   ${NTFY_TOKEN}"
  echo ""
fi

echo "🌐 Web Interfaces:"
echo "   Dashboard:    https://${DASHBOARD_WEB_HOSTNAME}"
echo "   Vaultwarden:  https://${VAULTWARDEN_WEB_HOSTNAME}"
echo "   Portainer:    https://${PORTAINER_WEB_HOSTNAME}"
echo "   Uptime Kuma:  https://${UPTIME_KUMA_WEB_HOSTNAME}"
echo "   LLDAP:        https://${LLDAP_WEB_HOSTNAME}"
echo "   Authelia:     https://${AUTHELIA_WEB_HOSTNAME}"
echo "   Ntfy:         https://${NTFY_WEB_HOSTNAME}"
echo ""
echo "⚠️  Remember to add the CA certificate to your devices' trust stores!"
echo "   CA Certificate: ${CA_CERT_OUT}"
