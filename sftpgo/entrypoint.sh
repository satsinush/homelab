#!/bin/sh
# Load LDAP bind secret into env (plugin has no *_FILE support).
set -eu
if [ -f /run/secrets/ldap_bind_password ]; then
  SFTPGO_PLUGIN_AUTH_LDAP_PASSWORD="$(tr -d '\r\n' < /run/secrets/ldap_bind_password)"
  export SFTPGO_PLUGIN_AUTH_LDAP_PASSWORD
fi
exec sftpgo "$@"
