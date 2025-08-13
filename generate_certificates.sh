#!/bin/bash

# This script creates a private Certificate Authority (CA) and uses it to generate
# a server certificate with Subject Alternative Names (SANs) for Nginx.

# Exit immediately if a command exits with a non-zero status.
set -e

# Load environment variables from the .env file
# Make sure the .env file is in the same directory as this script.
if [ -f .env ]; then
  export $(grep -v '^#' .env | sed 's/\r$//' | xargs)
fi

# --- Configuration Variables ---
CERT_DAYS=3650 # Validity period in days (10 years)
KEY_BITS=4096  # RSA key bits for stronger security
CERTS_DIR="./certificates"

# CA files
CA_KEY_OUT="${CERTS_DIR}/homelab-ca.key"
CA_CERT_OUT="${CERTS_DIR}/homelab-ca.crt"

# Server Certificate files
# The script will generate a private key (.key) and a certificate (.crt).
# The public key is embedded within the certificate (.crt) file.
KEY_OUT="${CERTS_DIR}/${HOMELAB_HOSTNAME}.key"
CERT_OUT="${CERTS_DIR}/${HOMELAB_HOSTNAME}.crt"
CSR_OUT="/tmp/${HOMELAB_HOSTNAME}.csr" # Temporary Certificate Signing Request
CONF_FILE="/tmp/server_ssl_config.cnf" # Temporary config file

# --- Certificate Details ---
COUNTRY="US"
STATE="Wisconsin"
CITY="Appleton"
ORGANIZATION="aneedham"
OU_NAME="homelab"
COMMON_NAME="${HOMELAB_HOSTNAME}" # Main server hostname

# List all Subject Alternative Names (SANs) for the server certificate.
declare -a SAN_DOMAINS=(
    "${HOMELAB_HOSTNAME}" # Main server hostname
    "${DASHBOARD_WEB_HOSTNAME}"
    "${PIHOLE_WEB_HOSTNAME}"
    "${NETDATA_WEB_HOSTNAME}"
    "${PORTAINER_WEB_HOSTNAME}"
    "${VAULTWARDEN_WEB_HOSTNAME}"
    "${UPTIME_KUMA_WEB_HOSTNAME}"
    "${NTFY_WEB_HOSTNAME}"
)

# --- Ensure SSL directory exists ---
mkdir -p "$CERTS_DIR"

# =============================================================================
# STAGE 1: CREATE THE PRIVATE CERTIFICATE AUTHORITY (CA)
# This part only runs if the CA key or certificate doesn't exist.
# =============================================================================

if [ ! -f "$CA_KEY_OUT" ] || [ ! -f "$CA_CERT_OUT" ]; then
    echo "--- Generating new Private Certificate Authority (CA) ---"

    # Generate the CA's private key
    sudo openssl genrsa -out "${CA_KEY_OUT}" "${KEY_BITS}"

    # Generate the CA's self-signed root certificate
    sudo openssl req -x509 -new -nodes -key "${CA_KEY_OUT}" -sha256 -days "${CERT_DAYS}" \
        -out "${CA_CERT_OUT}" \
        -subj "/C=${COUNTRY}/ST=${STATE}/O=${ORGANIZATION}/CN=${ORGANIZATION} Homelab CA"
    
    echo "CA created successfully."
    echo "IMPORTANT: Add '${CA_CERT_OUT}' to your devices' trust stores."
    echo ""
else
    echo "--- Found existing Certificate Authority. Skipping CA creation. ---"
    echo ""
fi

# =============================================================================
# STAGE 2: CREATE AND SIGN THE SERVER CERTIFICATE
# This part runs every time to generate a new server certificate.
# =============================================================================

echo "--- Generating Server Certificate signed by local CA ---"

# --- Generate OpenSSL Configuration File for the Server Cert ---
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

[v3_req]
subjectAltName = @alt_names

[alt_names]
EOF

# Dynamically add SAN domains to the config file
for i in "${!SAN_DOMAINS[@]}"; do
    echo "DNS.$((i+1)) = ${SAN_DOMAINS[$i]}" >> "$CONF_FILE"
done

# --- Generate Server Private Key and CSR ---
echo "1. Generating server private key..."
sudo openssl genrsa -out "${KEY_OUT}" "${KEY_BITS}"

echo "2. Generating Certificate Signing Request (CSR)..."
sudo openssl req -new -key "${KEY_OUT}" -out "${CSR_OUT}" -config "${CONF_FILE}"

# --- Sign the Server CSR with the CA Key ---
echo "3. Signing the server certificate with the CA..."
sudo openssl x509 -req -in "${CSR_OUT}" \
    -CA "${CA_CERT_OUT}" -CAkey "${CA_KEY_OUT}" -CAcreateserial \
    -out "${CERT_OUT}" -days "${CERT_DAYS}" -sha256 \
    -extfile "${CONF_FILE}" -extensions v3_req

# --- Set Permissions for the Private Key ---
echo "4. Setting permissions for private key..."
sudo chmod 600 "${KEY_OUT}"
sudo chmod 600 "${CA_KEY_OUT}" # Also ensure CA key is secure

# --- Install CA Certificate in System Trust Store ---
echo "5. Installing CA certificate in system trust store..."
sudo cp "${CA_CERT_OUT}" /etc/ca-certificates/trust-source/anchors/
sudo trust extract-compat

# --- Final Output ---
echo ""
echo "Certificate generation complete!"
echo "CA Certificate:      ${CA_CERT_OUT}"
echo "Server Certificate:  ${CERT_OUT}"
echo "Server Private Key:  ${KEY_OUT}"

# --- Clean up temporary files ---
sudo rm "$CONF_FILE"
sudo rm "$CSR_OUT"