FROM nginx:alpine

# Install gettext to provide envsubst
RUN apk add --no-cache gettext

# Copy your Nginx configuration template
COPY nginx/nginx.conf.template /etc/nginx/templates/nginx.conf.template

# Copy your startup script
COPY nginx/entrypoint.sh /entrypoint.sh

# Make the startup script executable
RUN chmod +x /entrypoint.sh

# Set the startup script as the ENTRYPOINT for the container
ENTRYPOINT ["/entrypoint.sh"]

# Expose port 80 and 443 and let the entrypoint script start Nginx
EXPOSE 80
EXPOSE 443