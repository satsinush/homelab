# Use the mvance/unbound image as our starting point
FROM mvance/unbound:latest

# --- Download root.hints ---
# Chaining these commands into a single RUN instruction creates only one layer.
# This is more efficient for image size and caching.
RUN apt-get update && \
    apt-get install -y curl && \
    curl -o /opt/unbound/etc/unbound/root.hints https://www.internic.net/domain/named.root && \
    apt-get purge -y --auto-remove curl && \
    rm -rf /var/lib/apt/lists/*

# --- Setup Entrypoint for Templating ---
# Copy your configuration template and entrypoint script into the image
COPY unbound.conf.template /opt/unbound/etc/unbound/unbound.conf.template
COPY entrypoint.sh /entrypoint.sh

# Install gettext for envsubst
RUN apt-get update && \
    apt-get install -y gettext && \
    rm -rf /var/lib/apt/lists/*

# Make the script executable
RUN chmod +x /entrypoint.sh

# Set our custom script as the command to run when the container starts
ENTRYPOINT ["/entrypoint.sh"]