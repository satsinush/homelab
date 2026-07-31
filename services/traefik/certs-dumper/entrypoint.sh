#!/bin/sh
# Watch Traefik acme.json and publish PEMs for Stalwart IMAPS/SMTPS.
# Idle when not using Let's Encrypt (private Homelab TLS is written by setup).
set -eu

resolver="${TRAEFIK_CERT_RESOLVER:-}"
if [ "$resolver" != "letsencrypt" ]; then
  echo "traefik-certs-dumper: TRAEFIK_CERT_RESOLVER=${resolver:-empty} — idle (private TLS)"
  exec sleep infinity
fi

echo "traefik-certs-dumper: watching /data/acme.json → /dump → /certs"
mkdir -p /dump /certs

# Wait until Traefik has stored at least one ACME certificate.
i=0
while [ "$i" -lt 360 ]; do
  if [ -f /data/acme.json ] && grep -q '"certificate"' /data/acme.json 2>/dev/null; then
    break
  fi
  i=$((i + 1))
  sleep 5
done

# One-shot dump + publish so Stalwart gets PEMs even before the first watch event.
# Invoke via sh: bind-mounted scripts often lack +x (and the dumper panics if the hook fails).
traefik-certs-dumper file \
  --version v3 \
  --source /data/acme.json \
  --dest /dump \
  --domain-subdir || true
sh /hooks/publish-and-reload.sh || true

exec traefik-certs-dumper file \
  --version v3 \
  --source /data/acme.json \
  --dest /dump \
  --domain-subdir \
  --watch \
  --post-hook "sh /hooks/publish-and-reload.sh"
