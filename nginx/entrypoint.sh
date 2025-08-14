#!/bin/sh

# Exit immediately if a command fails
set -e

# Define all environment variables that need to be substituted in the templates
VARS_TO_SUBSTITUTE='${HOMELAB_HOSTNAME} ${DASHBOARD_WEB_HOSTNAME} ${PIHOLE_WEB_HOSTNAME} ${NETDATA_WEB_HOSTNAME} ${PORTAINER_WEB_HOSTNAME} ${VAULTWARDEN_WEB_HOSTNAME} ${UPTIME_KUMA_WEB_HOSTNAME} ${NTFY_WEB_HOSTNAME} ${AUTHELIA_WEB_HOSTNAME} ${LLDAP_WEB_HOSTNAME}'

# --- Process Snippet Files ---
TEMPLATE_SNIPPET_DIR="/etc/nginx/templates/snippets"
OUTPUT_SNIPPET_DIR="/etc/nginx/conf.d/snippets"

# Ensure the output directory for snippets exists
mkdir -p "$OUTPUT_SNIPPET_DIR"

# Loop through each file in the templates/snippets directory
echo "Processing snippet templates from $TEMPLATE_SNIPPET_DIR..."
for template_file in "$TEMPLATE_SNIPPET_DIR"/*; do
    # Make sure we're only processing files
    if [ -f "$template_file" ]; then
        # Get the simple filename and remove '.template' from the end if present
        filename=$(basename "$template_file")
        filename="${filename%.template}"
        
        # Define the full output path
        output_file="$OUTPUT_SNIPPET_DIR/$filename"
        
        echo "  -> Substituting '$filename'"
        envsubst "$VARS_TO_SUBSTITUTE" < "$template_file" > "$output_file"
    fi
done
echo "Snippet processing complete."
# --- End Snippet Processing ---


# Process the main default.conf template (as before)
echo "Processing main template default.conf.template..."
envsubst "$VARS_TO_SUBSTITUTE" < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf
echo "Main template processing complete."


# Start Nginx in the foreground
echo "Starting Nginx..."
exec nginx -g 'daemon off;'