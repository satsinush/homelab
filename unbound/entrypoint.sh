#!/bin/sh

# Exit immediately if a command exits with a non-zero status.
set -e

# List of variables to substitute, taken from your .env file.
# It's safer to list them explicitly.
VARS_TO_SUBSTITUTE='${UNBOUND_DNS_PORT} ${UNBOUND_NUM_THREADS}'

# Use envsubst to replace the variables in the template and write the final config.
envsubst "$VARS_TO_SUBSTITUTE" < /opt/unbound/etc/unbound/unbound.conf.template > /opt/unbound/etc/unbound/unbound.conf

# The 'exec' command replaces the shell process with the unbound process,
# allowing it to receive signals correctly from Docker for graceful shutdown.
# '-d' runs unbound in the foreground.
# '-c' specifies the configuration file to use.
exec unbound -d -c /opt/unbound/etc/unbound/unbound.conf