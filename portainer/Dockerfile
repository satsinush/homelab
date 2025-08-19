# Stage 1: The "Builder"
# We use a full Alpine Linux image here because it has the 'apk' package manager.
FROM alpine:3.20 AS builder

# Install curl, jq, and their dependencies into this stage.
RUN apk update && apk add --no-cache curl jq


# Stage 2: The Final Image
# This starts from your original, minimal Portainer image.
FROM portainer/portainer-ce:latest

# Copy the binaries (curl, jq) from the 'builder' stage into our final image.
COPY --from=builder /usr/bin/curl /usr/bin/curl
COPY --from=builder /usr/bin/jq /usr/bin/jq

# IMPORTANT: Copy the shared libraries that curl and jq depend on.
# These are typically located in /lib and /usr/lib in Alpine.
COPY --from=builder /lib /lib
COPY --from=builder /usr/lib /usr/lib