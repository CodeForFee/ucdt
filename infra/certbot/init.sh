#!/bin/sh
# One-time bootstrap: replace the dummy cert (infra/certbot/dummy-cert.sh) with a real Let's
# Encrypt certificate, then reload nginx so it picks it up. Run once after the stack is up and
# SITE_ADDRESS's DNS A record already resolves to this VPS:
#
#   infra/certbot/init.sh
#
# infra/certbot/renew-cron.sh (installed on the host by docs/DEPLOY.md) keeps it renewed after
# that — this script is only for the very first certificate.
set -eu
cd "$(dirname "$0")/.."

# shellcheck disable=SC1091
[ -f .env ] && . ./.env
DOMAIN="${SITE_ADDRESS:?set SITE_ADDRESS in infra/.env}"

COMPOSE="docker compose -f compose.yml -f compose.prod.yml"
if [ "${1:-}" = "--local" ]; then
  COMPOSE="docker compose -f compose.yml"
fi

echo "Requesting a certificate for $DOMAIN..."
$COMPOSE run --rm --entrypoint certbot certbot certonly \
  --webroot -w /var/www/certbot \
  -d "$DOMAIN" \
  --email "admin@$DOMAIN" --agree-tos --no-eff-email \
  --non-interactive --force-renewal

echo "Reloading nginx..."
$COMPOSE exec nginx nginx -s reload
echo "Done — https://$DOMAIN should now serve a trusted certificate."
