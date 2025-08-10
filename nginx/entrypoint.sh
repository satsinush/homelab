#!/bin/sh

set -e

VARS_TO_SUBSTITUTE='${HOMELAB_HOSTNAME} ${DASHBOARD_WEB_HOSTNAME} ${PIHOLE_WEB_HOSTNAME} ${NETDATA_WEB_HOSTNAME} ${PORTAINER_WEB_HOSTNAME} ${VAULTWARDEN_WEB_HOSTNAME}'

envsubst "$VARS_TO_SUBSTITUTE" < /etc/nginx/templates/nginx.conf.template > /etc/nginx/conf.d/default.conf

# Now start Nginx
exec nginx -g 'daemon off;'