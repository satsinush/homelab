# Stage 1: Builder to generate configuration.yml
FROM alpine:3.20 AS builder
RUN apk add --no-cache gettext

WORKDIR /config
COPY configuration.yml.template .

# Generate configuration.yml from template using env vars
# You can pass environment variables at build time with --build-arg
ARG AUTHELIA_SESSION_SECRET
ARG AUTHELIA_STORAGE_ENCRYPTION_KEY
ARG AUTHELIA_JWT_SECRET
ARG DNS_DOMAIN
ARG LLDAP_LDAP_BASE_DN
ARG LLDAP_USER_PASSWORD
ARG AUTHELIA_WEB_HOSTNAME
ARG HOMELAB_HOSTNAME

ENV AUTHELIA_SESSION_SECRET=${AUTHELIA_SESSION_SECRET}
ENV AUTHELIA_STORAGE_ENCRYPTION_KEY=${AUTHELIA_STORAGE_ENCRYPTION_KEY}
ENV AUTHELIA_JWT_SECRET=${AUTHELIA_JWT_SECRET}
ENV DNS_DOMAIN=${DNS_DOMAIN}
ENV LLDAP_LDAP_BASE_DN=${LLDAP_LDAP_BASE_DN}
ENV LLDAP_USER_PASSWORD=${LLDAP_USER_PASSWORD}
ENV AUTHELIA_WEB_HOSTNAME=${AUTHELIA_WEB_HOSTNAME}
ENV HOMELAB_HOSTNAME=${HOMELAB_HOSTNAME}

RUN envsubst < configuration.yml.template > configuration.yml

# Stage 2: Official Authelia image
FROM authelia/authelia:latest

# Copy only the generated config
COPY --from=builder /config/configuration.yml /config/configuration.yml

# The container will just use the official entrypoint/cmd
