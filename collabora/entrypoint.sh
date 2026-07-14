#!/bin/bash
# Load Docker secret into Collabora's expected password env var.
set -euo pipefail

if [[ -f /run/secrets/collabora_admin_password ]]; then
  export password="$(tr -d '\n' </run/secrets/collabora_admin_password)"
fi
export username="${username:-admin}"

exec /start-collabora-online.sh "$@"
