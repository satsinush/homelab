#!/bin/sh
set -e

echo "[entrypoint] Injecting Vaultwarden secrets from /secrets..."

if [ -f /secrets/vaultwarden_admin_token ]; then
  export ADMIN_TOKEN=$(cat /secrets/vaultwarden_admin_token)
fi
if [ -f /secrets/homelab_password ]; then
  export SMTP_PASSWORD=$(cat /secrets/homelab_password)
fi
if [ -f /secrets/vaultwarden_oidc_secret ]; then
  export SSO_CLIENT_SECRET=$(cat /secrets/vaultwarden_oidc_secret)
fi

echo "[entrypoint] Starting process..."
exec "$@"
