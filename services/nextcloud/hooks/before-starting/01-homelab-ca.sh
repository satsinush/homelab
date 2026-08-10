#!/bin/sh
# Homelab CA is bind-mounted under /usr/local/share/ca-certificates, but the
# system trust store is rebuilt only when update-ca-certificates runs. Without
# this, user_oidc logout (/apps/user_oidc/sls) 500s on discovery TLS failures.
set -eu
if [ -f /usr/local/share/ca-certificates/homelab-ca.crt ]; then
  update-ca-certificates >/dev/null 2>&1 || update-ca-certificates || true
fi
