#!/bin/sh
# Build STALWART_RECOVERY_ADMIN from the regular Docker secret file.
set -eu
pass_file="${STALWART_ADMIN_PASSWORD_FILE:-/run/secrets/stalwart_admin_password}"
if [ ! -f "$pass_file" ]; then
    echo "stalwart entrypoint: missing admin password at $pass_file" >&2
    exit 1
fi
pass=$(tr -d '\n\r' < "$pass_file")
if [ -z "$pass" ]; then
    echo "stalwart entrypoint: admin password file is empty" >&2
    exit 1
fi
export STALWART_RECOVERY_ADMIN="admin:${pass}"
exec /usr/local/bin/stalwart "$@"
