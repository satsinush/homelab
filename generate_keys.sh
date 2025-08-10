#!/bin/bash

# This script generates a self-signed SSL certificate with Subject Alternative Names (SANs)
# for use with Nginx for internal network services.

# Exit immediately if a command exits with a non-zero status.
set -e

# Load environment variables from the .env file
# Make sure the .env file is in the same directory as this script.
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

# --- Configuration Variables ---
CERT_DAYS=7300 # Validity period in days (20 years)
KEY_BITS=2048 # RSA key bits
KEY_OUT="./ssl/nginx-all-sites.key"
CERT_OUT="./ssl/nginx-all-sites.crt"
CONF_FILE="/tmp/nginx_ssl_config.cnf" # Use /tmp for a temporary config file

# --- Certificate Details ---
# Fill these in with your actual information
COUNTRY="US"
STATE="Wisconsin"
CITY="Appleton"
ORGANIZATION="aneedham"
OU_NAME="homelab"
COMMON_NAME="${HOMELAB_HOSTNAME}" # Main server hostname or primary domain

# List all your Subject Alternative Names (SANs) here.
# These are all the domain names (hostnames) your Nginx server will serve via HTTPS.
declare -a SAN_DOMAINS=(
    "${HOMELAB_HOSTNAME}" # Main server hostname
    "${DASHBOARD_WEB_HOSTNAME}"
    "${PIHOLE_WEB_HOSTNAME}"
    "${NETDATA_WEB_HOSTNAME}"
)

# --- Generate OpenSSL Configuration File ---
echo "Generating OpenSSL configuration file: $CONF_FILE"
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
emailAddress = admin@rpi5-server.home.arpa # This email address is just for the cert, won't receive mail publicly

[v3_req]
subjectAltName = @alt_names

[alt_names]
EOF

# Dynamically add SAN domains to the config file
for i in "${!SAN_DOMAINS[@]}"; do
    echo "DNS.$((i+1)) = ${SAN_DOMAINS[$i]}" >> "$CONF_FILE"
done

echo "OpenSSL configuration file created:"
cat "$CONF_FILE"
echo ""

# --- Generate the Self-Signed Certificate ---
echo "Generating self-signed certificate and private key..."
sudo openssl req -x509 -nodes -days "${CERT_DAYS}" -newkey rsa:"${KEY_BITS}" \
-keyout "${KEY_OUT}" \
-out "${CERT_OUT}" \
-config "${CONF_FILE}" -extensions v3_req

# --- Set Permissions for the Private Key ---
echo "Setting permissions for private key..."
sudo chmod 600 "${KEY_OUT}"

echo "Certificate generation complete!"
echo "Certificate: ${CERT_OUT}"
echo "Private Key: ${KEY_OUT}"

# --- Generate SSH Keys for RustDesk ---
SSH_KEY_DIR="./rustdesk-keys"
SSH_PRIVATE_KEY="${SSH_KEY_DIR}/id_ed25519"
SSH_PUBLIC_KEY="${SSH_KEY_DIR}/id_ed25519.pub"

echo ""
echo "Generating SSH ed25519 keys for RustDesk..."

# Create the rustdesk-keys directory if it doesn't exist
mkdir -p "${SSH_KEY_DIR}"

# Generate ed25519 SSH key pair without passphrase
ssh-keygen -t ed25519 -f "${SSH_PRIVATE_KEY}" -N "" -C "rustdesk@${HOMELAB_HOSTNAME}"

# Set appropriate permissions for SSH keys
chmod 600 "${SSH_PRIVATE_KEY}"
chmod 644 "${SSH_PUBLIC_KEY}"

echo "SSH key generation complete!"
echo "Private Key: ${SSH_PRIVATE_KEY}"
echo "Public Key: ${SSH_PUBLIC_KEY}"

# --- Clean up temporary config file ---
rm "$CONF_FILE"