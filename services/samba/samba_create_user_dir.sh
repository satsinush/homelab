#!/bin/sh
# Replaces the image helper: it chowns to $user:$user, but our shares use
# force user=homelab — homes must be owned by homelab or Create fails.
# Args: <base_path> <username>  (e.g. /shares/users admin2)
set -eu
base="${1:?}"
user="${2:?}"
dir="${base}/${user}"
mkdir -p "$dir"
chown homelab:homelab "$dir"
chmod 700 "$dir"
exit 0
