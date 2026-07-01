# --- Stage 1: Build the React App ---
# We use an official Node.js image as a temporary "builder" container.
# Using 'alpine' keeps this stage small and fast. We name it 'react-builder'.
FROM node:20-alpine AS react-builder
WORKDIR /frontend



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
COPY ./word_games ./
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

RUN apk add --no-cache --virtual .build-deps python3 make g++ py3-setuptools \
    && npm install \
    && apk del .build-deps

# 2. Copy API source code
COPY ./homelab-dashboard/api/ .

# 3. Copy built frontend into /app/frontend
WORKDIR /app
COPY --from=react-builder /frontend/dist ./frontend/dist/

# 4. Copy word_games binary into /app/word_games
COPY --from=cpp-builder /build/build/mingw-core/word_games ./word_games/

# 5. Set working directory to /app/api for running the server
WORKDIR /app/api

CMD ["npm", "start"]