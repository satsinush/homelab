# Use the mvance/unbound image as our starting point.
# We now know this is Alpine-based for both ARM and x86-64 architectures.
FROM mvance/unbound:latest

# --- Install tools and Download root.hints ---
# Always use Alpine's 'apk' package manager.
# '--no-cache' is an efficient way to install without leaving cache files behind.
RUN if [ -x /usr/bin/apt-get ]; then \
        apt-get update && apt-get install -y --no-install-recommends curl gettext; \
    elif [ -x /sbin/apk ]; then \
        apk add --no-cache curl gettext; \
    else \
        echo "Unsupported package manager" && exit 1; \
    fi && \
    curl -o /opt/unbound/etc/unbound/root.hints https://www.internic.net/domain/named.root

# --- Setup Entrypoint for Templating ---
# The rest of the file is the same as before.
COPY unbound.conf.template /opt/unbound/etc/unbound/unbound.conf.template
COPY entrypoint.sh /entrypoint.sh

# Make the script executable
RUN chmod +x /entrypoint.sh

# Set our custom script as the command to run when the container starts
ENTRYPOINT ["/entrypoint.sh"]