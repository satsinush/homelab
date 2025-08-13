# --- Stage 1: Build the React App ---
# We use an official Node.js image as a temporary "builder" container.
# Using 'alpine' keeps this stage small and fast. We name it 'react-builder'.
FROM node:20-alpine AS react-builder
WORKDIR /frontend

# Declare the build arguments we expect to receive
ARG VITE_PIHOLE_WEB_HOSTNAME
ARG VITE_NETDATA_WEB_HOSTNAME
ARG VITE_PORTAINER_WEB_HOSTNAME
ARG VITE_VAULTWARDEN_WEB_HOSTNAME
ARG VITE_UPTIME_KUMA_WEB_HOSTNAME
ARG VITE_NTFY_WEB_HOSTNAME

# Set them as environment variables FOR THIS STAGE, so the 'npm run build' process can see them
ENV VITE_PIHOLE_WEB_HOSTNAME=${VITE_PIHOLE_WEB_HOSTNAME}
ENV VITE_NETDATA_WEB_HOSTNAME=${VITE_NETDATA_WEB_HOSTNAME}
ENV VITE_PORTAINER_WEB_HOSTNAME=${VITE_PORTAINER_WEB_HOSTNAME}
ENV VITE_VAULTWARDEN_WEB_HOSTNAME=${VITE_VAULTWARDEN_WEB_HOSTNAME}
ENV VITE_UPTIME_KUMA_WEB_HOSTNAME=${VITE_UPTIME_KUMA_WEB_HOSTNAME}
ENV VITE_NTFY_WEB_HOSTNAME=${VITE_NTFY_WEB_HOSTNAME}

# Copy the package.json and package-lock.json from your dashboard folder
# This step is separated to take advantage of Docker's layer caching.
# 'npm install' will only re-run if these files change.
COPY homelab-dashboard/frontend/package*.json ./
# Install all the project dependencies
RUN npm install
# Copy the rest of your dashboard's source code into the container
COPY homelab-dashboard/frontend ./
# Run the build script defined in your package.json to compile the React app
RUN npm run build




# --- Stage 2: Compile the C++ Executable ---
# (This stage is correct and remains the same)
FROM alpine:latest AS cpp-builder
RUN apk add --no-cache g++
WORKDIR /build
COPY ./word_games/src ./src/
RUN g++ -std=c++20 -static src/*.cpp -o word_games





# --- Stage 3: Build the Final Node.js Image ---
FROM node:20-alpine
WORKDIR /app

# 1. Copy API package files and install dependencies
COPY ./homelab-dashboard/api/package*.json ./api/
WORKDIR /app/api
RUN npm install

# 2. Copy API source code
COPY ./homelab-dashboard/api/ .

# 3. Copy built frontend into /app/frontend
WORKDIR /app
COPY --from=react-builder /frontend/dist ./frontend/dist/

# 4. Copy word_games binary and word_lists into /app/word_games
COPY --from=cpp-builder /build/word_games ./word_games/
COPY ./word_games/word_lists ./word_games/word_lists/

# 5. Set working directory to /app/api for running the server
WORKDIR /app/api

# The default command to run your Node.js server
CMD ["npm", "start"]