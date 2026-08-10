#!/bin/sh
set -eu
DOMAIN="${HOMELAB_HOSTNAME:?HOMELAB_HOSTNAME required}"
MAIL_SVC="${MAIL_SERVICE_NAME:-mail}"
MAIL_HOST="${MAIL_SVC}.${DOMAIN}"

mkdir -p /usr/share/nginx/html/mail /usr/share/nginx/html/.well-known/autoconfig/mail
sed -e "s/__DOMAIN__/${DOMAIN}/g" -e "s/__MAIL_HOST__/${MAIL_HOST}/g" \
  /template/config-v1.1.xml \
  > /usr/share/nginx/html/mail/config-v1.1.xml
cp /usr/share/nginx/html/mail/config-v1.1.xml \
  /usr/share/nginx/html/.well-known/autoconfig/mail/config-v1.1.xml

exec nginx -g 'daemon off;'
