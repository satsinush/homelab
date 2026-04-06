#!/bin/sh
set -e

echo "[entrypoint] Injecting Ntfy secrets from /secrets..."

if [ -f /secrets/ntfy_admin_users ]; then
  export NTFY_AUTH_USERS=$(cat /secrets/ntfy_admin_users)
fi
if [ -f /secrets/ntfy_admin_tokens ]; then
  export NTFY_AUTH_TOKENS=$(cat /secrets/ntfy_admin_tokens)
fi

echo "[entrypoint] Starting ntfy server..."
exec ntfy "$@"
