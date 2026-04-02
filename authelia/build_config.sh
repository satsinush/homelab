#!/bin/sh
set -e

# This script runs INSIDE the Docker builder stage.

# --- Configuration ---
TEMPLATE_FILE="/config/configuration.yml.template"
CONFIG_FILE="/config/configuration.yml"
KEY_FILE="/config/jwks/private.pem"
PLACEHOLDER="JWKS_KEY_PLACEHOLDER"
INDENTED_KEY_FILE="/config/indented_key.tmp"
RENDERED_TEMPLATE_FILE="/config/rendered_template.tmp"

echo "[build] Generating Authelia configuration..."

# 1. Check that the private key file exists.
if [ ! -f "$KEY_FILE" ]; then
    echo "[build] FATAL: Private key file not found at $KEY_FILE" >&2
    exit 1
fi

if [ ! -s "$KEY_FILE" ]; then
    echo "[build] FATAL: Private key file is empty at $KEY_FILE" >&2
    exit 1
fi

# 2. Create an indented version of the key.
sed 's/^/          /' "$KEY_FILE" > "$INDENTED_KEY_FILE"

# 3. Substitute env vars first.
envsubst < "$TEMPLATE_FILE" > "$RENDERED_TEMPLATE_FILE"

# 4. Replace placeholder with full indented key content.
awk -v placeholder="$PLACEHOLDER" -v key_file="$INDENTED_KEY_FILE" '
index($0, placeholder) {
    while ((getline line < key_file) > 0) {
        print line
    }
    close(key_file)
    next
}
{ print }
' "$RENDERED_TEMPLATE_FILE" > "$CONFIG_FILE"

rm -f "$INDENTED_KEY_FILE" "$RENDERED_TEMPLATE_FILE"

echo "[build] Configuration generated successfully."