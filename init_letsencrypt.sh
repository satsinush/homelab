#!/bin/bash

# --- Check if docker-compose is installed ---
if ! [ -x "$(command -v docker-compose)" ]; then
  echo 'Error: docker-compose is not installed.' >&2
  exit 1
fi

# --- Load .env file variables ---
if [ -f .env ]; then
  export $(echo $(cat .env | sed 's/#.*//g'| xargs) | envsubst)
fi

# --- Check for required variables ---
if [ -z "$LETSENCRYPT_DOMAINS" ] || [ -z "$LETSENCRYPT_EMAIL" ]; then
    echo "Error: LETSENCRYPT_DOMAINS and LETSENCRYPT_EMAIL must be set in your .env file."
    exit 1
fi

domains_arr=(${LETSENCRYPT_DOMAINS//,/ })
email_arg="--email $LETSENCRYPT_EMAIL"
staging_arg="" # Set to "--staging" for testing
rsa_key_size=4096
data_path="./certbot/letsencrypt"
main_domain=${domains_arr[0]}

# --- Check if certificates already exist ---
if [ -d "$data_path" ] && [ -d "$data_path/live/$main_domain" ]; then
  echo "### Let's Encrypt certificates for $main_domain already exist. Skipping creation. ###"
  exit 0
fi

# --- Create dummy certificates so Nginx can start ---
echo "### Creating dummy certificate for $main_domain ... ###"
path="$data_path/live/$main_domain"
mkdir -p "$path"
docker-compose run --rm --entrypoint "\
  openssl req -x509 -nodes -newkey rsa:$rsa_key_size -days 1\
    -keyout '$path/privkey.pem' \
    -out '$path/fullchain.pem' \
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

# --- Request Let's Encrypt certificate ---
echo "### Requesting Let's Encrypt certificate for $LETSENCRYPT_DOMAINS ... ###"
# Join domains to -d args
domain_args=""
for domain in "${domains_arr[@]}"; do
  domain_args="$domain_args -d $domain"
done

# Select appropriate email arg
case "$email_arg" in
  "") email_arg="--register-unsafely-without-email" ;;
  *) email_arg="--email $email_arg" ;;
esac

docker-compose run --rm --entrypoint "\
  certbot certonly --webroot -w /var/www/certbot \
    $staging_arg \
    $email_arg \
    $domain_args \
    --rsa-key-size $rsa_key_size \
    --agree-tos \
    --force-renewal" certbot
echo

# --- Stop Services ---
echo "### Stopping services ... ###"
docker-compose down
echo

echo "### Let's Encrypt certificate obtained successfully for $LETSENCRYPT_DOMAINS ###"