# --- Stage 1: Build the React Application ---
# We use an official Node.js image as a temporary "builder" container.
# Using 'alpine' keeps this stage small and fast. We name it 'builder'.
FROM node:20-alpine AS builder

# Set the working directory inside the builder container
WORKDIR /app

# Declare the build arguments we expect to receive
ARG VITE_PIHOLE_WEB_HOSTNAME
ARG VITE_NETDATA_WEB_HOSTNAME
ARG VITE_PORTAINER_WEB_HOSTNAME
ARG VITE_VAULTWARDEN_WEB_HOSTNAME
ARG VITE_UPTIME_KUMA_WEB_HOSTNAME

# Set them as environment variables FOR THIS STAGE, so the 'npm run build' process can see them
ENV VITE_PIHOLE_WEB_HOSTNAME=${VITE_PIHOLE_WEB_HOSTNAME}
ENV VITE_NETDATA_WEB_HOSTNAME=${VITE_NETDATA_WEB_HOSTNAME}
ENV VITE_PORTAINER_WEB_HOSTNAME=${VITE_PORTAINER_WEB_HOSTNAME}
ENV VITE_VAULTWARDEN_WEB_HOSTNAME=${VITE_VAULTWARDEN_WEB_HOSTNAME}
ENV VITE_UPTIME_KUMA_WEB_HOSTNAME=${VITE_UPTIME_KUMA_WEB_HOSTNAME}

# Copy the package.json and package-lock.json from your dashboard folder
# This step is separated to take advantage of Docker's layer caching.
# 'npm install' will only re-run if these files change.
COPY homelab-dashboard/package*.json ./

# Install all the project dependencies
RUN npm install

# Copy the rest of your dashboard's source code into the container
COPY homelab-dashboard ./

# Run the build script defined in your package.json to compile the React app
RUN npm run build

# --- Stage 2: Create the final Nginx Image ---
# This stage uses the lightweight nginx:alpine image for the final product
FROM nginx:alpine

# Install gettext to provide envsubst
RUN apk add --no-cache gettext

# Copy the final, static build files from the 'builder' stage's /app/dist directory
# into the directory Nginx serves files from by default.
COPY --from=builder /app/dist /usr/share/nginx/html

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