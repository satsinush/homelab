#!/bin/sh
set -e

# This script runs INSIDE the Docker builder stage.

# --- Configuration ---
TEMPLATE_FILE="/config/configuration.yml.template"
CONFIG_FILE="/config/configuration.yml"
KEY_FILE="/config/jwks/private.pem"
PLACEHOLDER="JWKS_KEY_PLACEHOLDER"
INDENTED_KEY_FILE="/config/indented_key.tmp"

echo "[build] Generating Authelia configuration..."

# 1. Check that the private key file exists.
if [ ! -f "$KEY_FILE" ]; then
    echo "[build] FATAL: Private key file not found at $KEY_FILE" >&2
    exit 1
fi

# 2. Create an indented version of the key.
sed 's/^/          /' "$KEY_FILE" > "$INDENTED_KEY_FILE"

# 3. Substitute env vars and inject the indented key.
envsubst < "$TEMPLATE_FILE" | sed -e "/$PLACEHOLDER/r $INDENTED_KEY_FILE" -e "/$PLACEHOLDER/d" > "$CONFIG_FILE"

echo "[build] Configuration generated successfully."