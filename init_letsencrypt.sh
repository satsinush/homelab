#!/bin/bash

# Exit immediately if a command exits with a non-zero status.
set -e

# --- Load .env file variables (Robust Method) ---
if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

# --- Check for required variables ---
if [ -z "$LETSENCRYPT_DOMAINS" ] || [ -z "$LETSENCRYPT_EMAIL" ]; then
    echo "Error: LETSENCRYPT_DOMAINS and LETSENCRYPT_EMAIL must be set in your .env file."
    exit 1
fi

# --- Configuration ---
domains_arr=(${LETSENCRYPT_DOMAINS//,/ })
main_domain=${domains_arr[0]}
rsa_key_size=4096
data_path="./certbot/letsencrypt"
dummy_cert_path="/etc/letsencrypt/live/$main_domain"

# --- Check if certificates already exist ---
if [ -d "$data_path" ] && [ -d "$data_path/live/$main_domain" ]; then
  echo "### Let's Encrypt certificates for $main_domain already exist. Skipping creation. ###"
  exit 0
fi

# --- Create dummy certificates so Nginx can start ---
echo "### Creating dummy certificate for $main_domain ... ###"
mkdir -p "$data_path/live/$main_domain"
docker-compose run --rm --entrypoint "\
  openssl req -x509 -nodes -newkey rsa:$rsa_key_size -days 1\
    -keyout '$dummy_cert_path/privkey.pem' \
    -out '$dummy_cert_path/fullchain.pem' \
    -subj '/CN=localhost'" certbot > /dev/null 2>&1
echo

# --- Start Nginx ---
echo "### Starting Nginx ... ###"
docker-compose up -d nginx
echo

# --- Delete dummy certificates ---
echo "### Deleting dummy certificate for $main_domain ... ###"
docker-compose run --rm --entrypoint "\
  rm -Rf /etc/letsencrypt/live/$main_domain && \
  rm -Rf /etc/letsencrypt/archive/$main_domain && \
  rm -Rf /etc/letsencrypt/renewal/$main_domain.conf" certbot > /dev/null 2>&1
echo

# --- Request Let's Encrypt production certificate ---
echo "### Requesting Let's Encrypt certificate for $LETSENCRYPT_DOMAINS ... ###"
# Join domains to -d args
domain_args=""
for domain in "${domains_arr[@]}"; do
  domain_args="$domain_args -d $domain"
done

# Set email argument correctly
if [ -z "$LETSENCRYPT_EMAIL" ]; then
  email_arg="--register-unsafely-without-email"
else
  email_arg="--email $LETSENCRYPT_EMAIL"
fi

docker-compose run --rm --entrypoint "\
  certbot certonly --webroot -w /var/www/certbot \
    $email_arg \
    $domain_args \
    --rsa-key-size $rsa_key_size \
    --agree-tos \
    --force-renewal" certbot
echo

# --- Stop Services ---
echo "### Stopping services ... ###"
docker-compose down nginx
echo

echo "### Let's Encrypt certificate obtained successfully for $LETSENCRYPT_DOMAINS ###"