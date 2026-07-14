#!/bin/bash
# Load Docker secret into Collabora's expected password env var.
# Entrypoint runs as root (compose user: "0:0") so host 0600 secrets are readable,
# then drops to cool before starting CODE.
set -euo pipefail

if [[ -f /run/secrets/collabora_admin_password ]]; then
  export password="$(tr -d '\n' </run/secrets/collabora_admin_password)"
fi
export username="${username:-admin}"

if [[ "$(id -u)" -eq 0 ]]; then
  exec setpriv --reuid=cool --regid=cool --clear-groups -- /start-collabora-online.sh "$@"
fi

exec /start-collabora-online.sh "$@"
