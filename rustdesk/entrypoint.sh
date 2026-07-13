#!/bin/sh
# Load Docker secrets into env vars expected by rustdesk-console
# (the app has no *_FILE support).

set -eu

read_secret() {
  path="$1"
  if [ -f "$path" ]; then
    # trim trailing newlines
    tr -d '\r\n' < "$path"
  fi
}

if [ -z "${RUSTDESK_API_ADMIN_PASSWORD:-}" ]; then
  RUSTDESK_API_ADMIN_PASSWORD="$(read_secret /run/secrets/rustdesk_admin_password)"
  export RUSTDESK_API_ADMIN_PASSWORD
fi

if [ -z "${RUSTDESK_API_JWT_KEY:-}" ]; then
  RUSTDESK_API_JWT_KEY="$(read_secret /run/secrets/rustdesk_api_jwt_key)"
  export RUSTDESK_API_JWT_KEY
fi

if [ -z "${RUSTDESK_API_RUSTDESK_KEY:-}" ] && [ -f /app/public-configs/rustdesk_public_key ]; then
  RUSTDESK_API_RUSTDESK_KEY="$(read_secret /app/public-configs/rustdesk_public_key)"
  export RUSTDESK_API_RUSTDESK_KEY
fi

exec "$@"
