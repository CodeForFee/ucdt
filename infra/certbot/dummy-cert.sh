#!/bin/sh
# Runs once before nginx starts. nginx's config always terminates TLS (infra/nginx.conf.template),
# so it needs SOME certificate on disk even before infra/certbot/init.sh has obtained the real
# one — a self-signed placeholder lets it bind :443 and serve the ACME HTTP-01 challenge on :80.
set -e

DOMAIN="${SITE_ADDRESS:-localhost}"
DIR="/etc/letsencrypt/live/$DOMAIN"

if [ -f "$DIR/fullchain.pem" ]; then
  echo "dummy-cert: $DIR already has a certificate, leaving it alone"
  exit 0
fi

mkdir -p "$DIR"
openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
  -keyout "$DIR/privkey.pem" -out "$DIR/fullchain.pem" \
  -subj "/CN=$DOMAIN"
echo "dummy-cert: wrote a 1-day self-signed placeholder for $DOMAIN"
