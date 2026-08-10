#!/bin/sh
# Bind-mount of /var/lib/samba hides image defaults; Samba needs private/ for msg.sock.
set -eu
mkdir -p /var/lib/samba/private /var/lib/samba/lock /var/lib/samba/msg.lock /var/log/samba
chmod 700 /var/lib/samba/private

# Create the "homelab" owner (PUID:PGID) BEFORE account users.
PUID="${PUID:-1000}"
PGID="${PGID:-1000}"
if ! getent group homelab >/dev/null 2>&1; then
    addgroup -g "$PGID" homelab 2>/dev/null || addgroup homelab
fi
if ! getent passwd homelab >/dev/null 2>&1; then
    adduser -D -H -u "$PUID" -G homelab -s /bin/false homelab 2>/dev/null \
        || adduser -D -H -G homelab -s /bin/false homelab
fi

# Persist smbpasswd across restarts (extra users are synced via host-api /smb/set-password).
if [ ! -f /var/lib/samba/private/smbpasswd ]; then
    touch /var/lib/samba/private/smbpasswd
    chmod 600 /var/lib/samba/private/smbpasswd
fi

# Ensure bootstrap admin exists / password matches Authentik (NTLM requires passdb).
if [ -n "${HOMELAB_USERNAME:-}" ] && [ -n "${HOMELAB_PASSWORD:-}" ]; then
    export "ACCOUNT_${HOMELAB_USERNAME}=${HOMELAB_PASSWORD}"
fi

# dfree.sh is bind-mounted :ro — ensure +x on the host, not here.

exec /container/scripts/entrypoint.sh "$@"
