#!/bin/sh
# Copy the best ACME dump for mail.<hostname> into the shared PEM dir, then
# ask Stalwart to ReloadTlsCertificates (no docker restart / docker.sock).
set -eu

hostname="${HOMELAB_HOSTNAME:-}"
mail_svc="${MAIL_SERVICE_NAME:-mail}"
mail_host="${mail_svc}.${hostname}"

pick_dir() {
  for candidate in "$mail_host" "$hostname"; do
    if [ -n "$candidate" ] && [ -f "/dump/${candidate}/certificate.crt" ] \
      && [ -f "/dump/${candidate}/privatekey.key" ]; then
      echo "/dump/${candidate}"
      return 0
    fi
  done
  # Fallback: first domain dump with both files.
  for dir in /dump/*/; do
    [ -d "$dir" ] || continue
    if [ -f "${dir}certificate.crt" ] && [ -f "${dir}privatekey.key" ]; then
      echo "${dir%/}"
      return 0
    fi
  done
  return 1
}

src="$(pick_dir)" || {
  echo "traefik-certs-dumper: no usable dump under /dump yet" >&2
  exit 0
}

mkdir -p /certs
cp -f "${src}/certificate.crt" /certs/fullchain.pem
cp -f "${src}/privatekey.key" /certs/privkey.pem
# Stalwart runs as uid 2000.
chown 2000:2000 /certs/fullchain.pem /certs/privkey.pem 2>/dev/null || true
chmod 644 /certs/fullchain.pem
chmod 600 /certs/privkey.pem
echo "traefik-certs-dumper: published $(basename "$src") → /certs"

pass_file="${STALWART_ADMIN_PASSWORD_FILE:-/secrets/stalwart_admin_password}"
if [ ! -s "$pass_file" ]; then
  echo "traefik-certs-dumper: no admin password; skip ReloadTlsCertificates" >&2
  exit 0
fi

pass="$(cat "$pass_file")"
# BusyBox wget has no --user; use Basic auth header.
auth="$(printf 'admin:%s' "$pass" | base64 | tr -d '\n')"
payload='{"using":["urn:ietf:params:jmap:core","urn:stalwart:jmap"],"methodCalls":[["x:Action/set",{"create":{"a1":{"@type":"ReloadTlsCertificates"}}},"c1"]]}'

if wget -qO- \
  --header="Authorization: Basic ${auth}" \
  --header="Content-Type: application/json" \
  --post-data="$payload" \
  "http://stalwart:8080/jmap" >/dev/null 2>&1; then
  echo "traefik-certs-dumper: Stalwart ReloadTlsCertificates ok"
else
  echo "traefik-certs-dumper: Stalwart reload skipped/failed (mail may not be up yet)" >&2
fi
