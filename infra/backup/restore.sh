#!/bin/sh
# POSIX sh. Restores a pg_dump -Fc file into the running `postgres` container.
# Run this on the VPS host (it shells out to `docker` / `docker compose`), not inside a container.
#
# Usage: infra/backup/restore.sh <dumpfile> [database]
#
#   infra/backup/restore.sh /var/backups/ucdt/ucdt-20260924T0300Z.dump
#   infra/backup/restore.sh /var/backups/ucdt/ucdt-20260924T0300Z.dump ucdt_restore_test
#
# WARNING: this stops climate-api, climate-worker and backup (the services that hold
# connections to Postgres) so the drop below cannot be blocked, FORCE-drops and recreates
# the target database, restores into it, then starts those services again -- even if the
# restore itself fails. Everything currently in that database is LOST. Never point this at
# the live `ucdt` database unless you mean to replace all its data -- take a fresh backup
# first if unsure.
#
# RESTORE_DRY_RUN=1 prints the docker compose stop/start commands instead of running them,
# for exercising this script against a scratch database without touching the live stack.
set -eu

dumpfile="${1:?usage: restore.sh <dumpfile> [database]}"
db="${2:-${POSTGRES_DB:-ucdt}}"
user="${POSTGRES_USER:-ucdt}"
container="${POSTGRES_CONTAINER:-ucdt-postgres-1}"
dry_run="${RESTORE_DRY_RUN:-0}"

# Resolve infra/compose.yml + infra/compose.prod.yml relative to THIS script, so restore.sh
# works no matter the caller's current directory.
SCRIPT_DIR="$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)"
INFRA_DIR="$(CDPATH='' cd -- "$SCRIPT_DIR/.." && pwd)"
COMPOSE_YML="$INFRA_DIR/compose.yml"
COMPOSE_PROD_YML="$INFRA_DIR/compose.prod.yml"
STOP_SERVICES="climate-api climate-worker backup"

if [ ! -f "$dumpfile" ]; then
    echo "restore.sh: $dumpfile not found" >&2
    exit 1
fi

if ! docker inspect "$container" >/dev/null 2>&1; then
    echo "restore.sh: container '$container' not found (set POSTGRES_CONTAINER=<name> if it differs)" >&2
    exit 1
fi

echo "!!! WARNING !!!"
echo "This will stop [$STOP_SERVICES], then FORCE-drop database '$db' inside container"
echo "'$container' and restore it from:"
echo "  $dumpfile"
echo "All current data in '$db' will be LOST. This cannot be undone."
printf 'Type the database name (%s) to continue: ' "$db"
read -r confirm
if [ "$confirm" != "$db" ]; then
    echo "restore.sh: confirmation did not match, aborting" >&2
    exit 1
fi

stopped=0
restore_cleanup() {
    if [ "$stopped" = 1 ]; then
        echo "restore.sh: starting $STOP_SERVICES back up"
        if [ "$dry_run" = "1" ]; then
            echo "[dry-run] docker compose -f $COMPOSE_YML -f $COMPOSE_PROD_YML start $STOP_SERVICES"
        else
            # shellcheck disable=SC2086  # STOP_SERVICES is a fixed, space-separated list of service names.
            docker compose -f "$COMPOSE_YML" -f "$COMPOSE_PROD_YML" start $STOP_SERVICES
        fi
    fi
}
trap restore_cleanup EXIT

echo "restore.sh: stopping $STOP_SERVICES"
if [ "$dry_run" = "1" ]; then
    echo "[dry-run] docker compose -f $COMPOSE_YML -f $COMPOSE_PROD_YML stop $STOP_SERVICES"
else
    # shellcheck disable=SC2086  # STOP_SERVICES is a fixed, space-separated list of service names.
    docker compose -f "$COMPOSE_YML" -f "$COMPOSE_PROD_YML" stop $STOP_SERVICES
fi
stopped=1

# --force disconnects any other sessions still holding the database open (belt-and-braces on
# top of stopping the services above -- also covers connections from a psql/pgAdmin session
# a human left open).
docker exec -i "$container" dropdb -U "$user" --if-exists --force "$db"
docker exec -i "$container" createdb -U "$user" "$db"
docker exec -i "$container" pg_restore -U "$user" -d "$db" --no-owner <"$dumpfile"

echo "restore.sh: restored $dumpfile into database '$db'"
