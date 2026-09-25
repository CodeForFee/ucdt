#!/bin/sh
# Installed on the VPS host (not in a container) by a daily crontab entry — see docs/DEPLOY.md:
#   0 3 * * * /opt/ucdt/infra/certbot/renew-cron.sh >> /var/log/ucdt-certbot.log 2>&1
#
# certbot renew is a no-op unless a certificate is within 30 days of expiry, so running it daily
# is the standard, safe pattern. Reloading nginx is also a no-op when nothing renewed.
set -eu
cd "$(dirname "$0")/.."

COMPOSE="docker compose -f compose.yml -f compose.prod.yml"
$COMPOSE run --rm --entrypoint certbot certbot renew --webroot -w /var/www/certbot
$COMPOSE exec nginx nginx -s reload
