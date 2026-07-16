#!/bin/sh
set -eu
if [ -f /run/secrets/authentik_ldap_outpost_token ]; then
  AUTHENTIK_TOKEN="$(tr -d '\r\n' < /run/secrets/authentik_ldap_outpost_token)"
  export AUTHENTIK_TOKEN
fi
exec /ldap "$@"
