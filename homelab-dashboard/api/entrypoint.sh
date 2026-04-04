#!/bin/sh
set -e

echo "[entrypoint] Injecting secrets from /secrets..."

if [ -f /secrets/homelab_api_session_secret ]; then
  export HOMELAB_API_SESSION_SECRET=$(cat /secrets/homelab_api_session_secret)
fi
if [ -f /secrets/dashboard_oidc_secret ]; then
  export DASHBOARD_OIDC_SECRET=$(cat /secrets/dashboard_oidc_secret)
fi
if [ -f /secrets/ntfy_admin_tokens ]; then
  export NTFY_ADMIN_TOKENS=$(cat /secrets/ntfy_admin_tokens)
fi

echo "[entrypoint] Starting process..."
exec "$@"
