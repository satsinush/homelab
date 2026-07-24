#!/bin/sh
# Samba dfree command — report free space based on HOMELAB_DEFAULT_QUOTA_GB.
# Args from Samba: <path>
set -eu
PATH_ARG="${1:-.}"
QUOTA_GB="${HOMELAB_DEFAULT_QUOTA_GB:-50}"
QUOTA_BLOCKS=$((QUOTA_GB * 1024 * 1024)) # 1KB blocks

USED_KB=$(du -sk "$PATH_ARG" 2>/dev/null | awk '{print $1}')
USED_KB=${USED_KB:-0}
FREE=$((QUOTA_BLOCKS - USED_KB))
if [ "$FREE" -lt 0 ]; then
  FREE=0
fi
# total free (1KB blocks)
echo "$QUOTA_BLOCKS $FREE"
