#!/bin/sh
# POSIX sh. Restores a pg_dump -Fc file into the running `postgres` container.
# Run this on the VPS host (it shells out to `docker exec`), not inside a container.
#
# Usage: infra/backup/restore.sh <dumpfile> [database]
#
#   infra/backup/restore.sh /var/backups/ucdt/ucdt-20260924T0300Z.dump
#   infra/backup/restore.sh /var/backups/ucdt/ucdt-20260924T0300Z.dump ucdt_restore_test
#
# WARNING: this DROPS and recreates the target database, then restores into it. Everything
# currently in that database is LOST. Never point it at the live `ucdt` database unless you
# mean to replace all its data with the dump -- take a fresh backup first if unsure.
set -eu

dumpfile="${1:?usage: restore.sh <dumpfile> [database]}"
db="${2:-${POSTGRES_DB:-ucdt}}"
user="${POSTGRES_USER:-ucdt}"
container="${POSTGRES_CONTAINER:-ucdt-postgres-1}"

if [ ! -f "$dumpfile" ]; then
    echo "restore.sh: $dumpfile not found" >&2
    exit 1
fi

if ! docker inspect "$container" >/dev/null 2>&1; then
    echo "restore.sh: container '$container' not found (set POSTGRES_CONTAINER=<name> if it differs)" >&2
    exit 1
fi

echo "!!! WARNING !!!"
echo "This will DROP database '$db' inside container '$container' and restore it from:"
echo "  $dumpfile"
echo "All current data in '$db' will be LOST. This cannot be undone."
printf 'Type the database name (%s) to continue: ' "$db"
read -r confirm
if [ "$confirm" != "$db" ]; then
    echo "restore.sh: confirmation did not match, aborting" >&2
    exit 1
fi

docker exec -i "$container" dropdb -U "$user" --if-exists "$db"
docker exec -i "$container" createdb -U "$user" "$db"
docker exec -i "$container" pg_restore -U "$user" -d "$db" --no-owner <"$dumpfile"

echo "restore.sh: restored $dumpfile into database '$db'"
