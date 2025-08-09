# Use the mvance/unbound image as our starting point
FROM mvance/unbound:latest

# --- Install tools and Download root.hints ---
# This RUN command is now architecture-aware. It checks which package
# manager is available and runs the appropriate command.
RUN if command -v apk >/dev/null 2>&1; then \
        # If 'apk' exists (on Alpine), use it.
        apk add --no-cache curl gettext; \
    else \
        # Otherwise, assume 'apt-get' exists (on Debian).
        # Note: 'gettext-base' provides envsubst on Debian.
        apt-get update && apt-get install -y curl gettext-base && rm -rf /var/lib/apt/lists/*; \
    fi && \
    # This command runs after the correct tools are installed
    curl -o /opt/unbound/etc/unbound/root.hints https://www.internic.net/domain/named.root

# --- Setup Entrypoint for Templating ---
# The rest of the file is the same as before
COPY unbound.conf.template /opt/unbound/etc/unbound/unbound.conf.template
COPY entrypoint.sh /entrypoint.sh

# Make the script executable
RUN chmod +x /entrypoint.sh

# Set our custom script as the command to run when the container starts
ENTRYPOINT ["/entrypoint.sh"]