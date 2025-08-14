#!/bin/sh
set -e

echo "[entrypoint] Generating configuration.yml from template..."
envsubst < /config/configuration.yml.template > /config/configuration.yml

echo "[entrypoint] Starting Authelia..."
exec authelia --config /config/configuration.yml
