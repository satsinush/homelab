#!/bin/sh
# Bind-mount of /var/lib/samba hides image defaults; Samba needs private/ for msg.sock.
set -eu
mkdir -p /var/lib/samba/private /var/lib/samba/lock /var/lib/samba/msg.lock /var/log/samba
chmod 700 /var/lib/samba/private
exec /container/scripts/entrypoint.sh "$@"
