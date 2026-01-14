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
ARG VITE_LLDAP_WEB_HOSTNAME
ARG VITE_AUTHELIA_WEB_HOSTNAME

# Set them as environment variables FOR THIS STAGE, so the 'npm run build' process can see them
ENV VITE_PIHOLE_WEB_HOSTNAME=${VITE_PIHOLE_WEB_HOSTNAME}
ENV VITE_NETDATA_WEB_HOSTNAME=${VITE_NETDATA_WEB_HOSTNAME}
ENV VITE_PORTAINER_WEB_HOSTNAME=${VITE_PORTAINER_WEB_HOSTNAME}
ENV VITE_VAULTWARDEN_WEB_HOSTNAME=${VITE_VAULTWARDEN_WEB_HOSTNAME}
ENV VITE_UPTIME_KUMA_WEB_HOSTNAME=${VITE_UPTIME_KUMA_WEB_HOSTNAME}
ENV VITE_NTFY_WEB_HOSTNAME=${VITE_NTFY_WEB_HOSTNAME}
ENV VITE_LLDAP_WEB_HOSTNAME=${VITE_LLDAP_WEB_HOSTNAME}
ENV VITE_AUTHELIA_WEB_HOSTNAME=${VITE_AUTHELIA_WEB_HOSTNAME}

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




# --- Stage 2: Compile the C++ Executable using CMake ---
# Build a minimal CLI executable using the mingw-core preset
FROM alpine:latest AS cpp-builder
RUN apk add --no-cache g++ cmake ninja make
WORKDIR /build
COPY ./word_games/CMakeLists.txt ./
COPY ./word_games/CMakePresets.json ./
COPY ./word_games/src ./src/
COPY ./word_games/resources ./resources/
# Configure and build using mingw-core preset (add -static flag for Alpine compatibility)
RUN cmake --preset mingw-core -DCMAKE_CXX_FLAGS="-static" \
    && cmake --build --preset mingw-core --target p++
# Rename the executable to word_games for consistency with API
RUN mv build/mingw-core/p++ build/mingw-core/word_games



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

# 4. Copy word_games binary and words.bin into /app/word_games
COPY --from=cpp-builder /build/build/mingw-core/word_games ./word_games/
COPY ./word_games/resources ./word_games/resources/

# 5. Set working directory to /app/api for running the server
WORKDIR /app/api

# The default command to run your Node.js server
CMD ["npm", "start"]