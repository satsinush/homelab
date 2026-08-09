# --- Stage 1: Build the React App ---
# We use an official Node.js image as a temporary "builder" container.
# Using 'alpine' keeps this stage small and fast. We name it 'react-builder'.
FROM node:20-alpine AS react-builder
WORKDIR /build

# Shared contracts (imported as @shared/* from the frontend)
COPY services/dashboard/shared ./shared

# Frontend package files first for layer caching
COPY services/dashboard/frontend/package*.json ./frontend/
WORKDIR /build/frontend
RUN npm install

COPY services/dashboard/frontend ./
RUN npm run build



# --- Stage 2: Compile the C++ Executable using CMake ---
# Build a minimal CLI executable using the mingw-core preset
FROM alpine:latest AS cpp-builder
RUN apk add --no-cache g++ cmake ninja make
WORKDIR /build
# Copy C++ source files
COPY ./puzzle-plus-plus ./
# Configure and build using mingw-core preset (add -static flag for Alpine compatibility)
RUN cmake --preset mingw-core -DCMAKE_CXX_FLAGS="-static" \
    && cmake --build --preset mingw-core --target p++
RUN mv build/mingw-core/p++ build/mingw-core/p++_bin



# --- Stage 3: Express API & Runtime ---
FROM node:20-alpine AS stage-2
WORKDIR /app

# 1. Install production dependencies
COPY ./services/dashboard/api/package*.json ./api/
WORKDIR /app/api

RUN apk add --no-cache --virtual .build-deps python3 make g++ py3-setuptools \
    && npm install \
    && apk del .build-deps

# 2. Copy API source and typecheck (runtime uses tsx + @shared path alias)
COPY ./services/dashboard/api/ .
RUN npm run build

# 3. Copy built frontend into /app/frontend
WORKDIR /app
COPY --from=react-builder /build/frontend/dist ./frontend/dist/

# 4. Copy p++ binary into /app/puzzle-plus-plus
COPY --from=cpp-builder /build/build/mingw-core/p++_bin ./puzzle-plus-plus/p++

# 5. Set working directory to /app/api for running the server
WORKDIR /app/api

CMD ["npm", "start"]
