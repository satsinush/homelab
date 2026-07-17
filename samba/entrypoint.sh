#!/bin/sh
# Bind-mount of /var/lib/samba hides image defaults; Samba needs private/ for msg.sock.
set -eu
mkdir -p /var/lib/samba/private /var/lib/samba/lock /var/lib/samba/msg.lock /var/log/samba
chmod 700 /var/lib/samba/private

# accounts.env is the source of truth — rebuild the passdb from env on every
# start so deleted accounts don't linger as orphaned (passdb-corrupting) entries.
# Pre-create with 0600 or smbpasswd creates it 0644 and logs a warning.
rm -f /var/lib/samba/private/smbpasswd
touch /var/lib/samba/private/smbpasswd
chmod 600 /var/lib/samba/private/smbpasswd

# Create the "homelab" owner (PUID:PGID) BEFORE the image entrypoint adds the
# ACCOUNT_ users, so it reserves that uid. Shares use force user/group=homelab
# to keep host file ownership uniform and matching SFTPGo/WebDAV. Account users
# get auto-assigned uids — explicit duplicate UID_ vars corrupt the passdb.
PUID="${PUID:-1000}"
PGID="${PGID:-1000}"
if ! getent group homelab >/dev/null 2>&1; then
    addgroup -g "$PGID" homelab 2>/dev/null || addgroup homelab
fi
if ! getent passwd homelab >/dev/null 2>&1; then
    adduser -D -H -u "$PUID" -G homelab -s /bin/false homelab 2>/dev/null \
        || adduser -D -H -G homelab -s /bin/false homelab
fi

exec /container/scripts/entrypoint.sh "$@"
