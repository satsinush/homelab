# --- Stage 1: Compile the C++ Executable ---
# (This stage is correct and remains the same)
FROM alpine:latest AS cpp-builder
RUN apk add --no-cache g++
WORKDIR /build
COPY ./word_games/src ./src/
RUN g++ -std=c++20 -static src/*.cpp -o word_games


# --- Stage 2: Build the Final Node.js Image ---
FROM node:20-alpine
WORKDIR /app

# 1. Copy package files and install dependencies
COPY ./homelab-api/package*.json ./
RUN npm install

# 2. Copy your application source code
COPY ./homelab-api/ ./

# 3. NOW, create the word_games directory and add its content.
# This happens AFTER the main source is copied, so it won't be overwritten.
RUN mkdir -p /app/word_games
COPY --from=cpp-builder /build/word_games ./word_games/
COPY ./word_games/word_lists ./word_games/word_lists/

# The default command to run your Node.js server
CMD ["npm", "start"]