#!/bin/sh
# POSIX sh. One backup run: pg_dump -Fc the target database into $BACKUP_DIR, then prune to
# the newest $KEEP dumps. Meant to be run inside the `backup` service (see entrypoint.sh) or
# by hand for a one-off/manual dump:
#   docker compose -f infra/compose.yml -f infra/compose.prod.yml run --rm backup /backup/backup.sh
#
# Env (all have defaults matching infra/compose.prod.yml):
#   PGHOST PGPORT PGUSER PGPASSWORD PGDATABASE  -- passed to pg_dump/psql via libpq
#   BACKUP_DIR   -- where dumps land inside the container (default /backups)
#   KEEP         -- how many dumps to retain (default 7)
set -eu

BACKUP_DIR="${BACKUP_DIR:-/backups}"
KEEP="${KEEP:-7}"
PGDATABASE="${PGDATABASE:-ucdt}"
PGHOST="${PGHOST:-postgres}"
PGPORT="${PGPORT:-5432}"
PGUSER="${PGUSER:-ucdt}"

mkdir -p "$BACKUP_DIR"

ts="$(date -u +%Y%m%dT%H%M%SZ)"
out="$BACKUP_DIR/${PGDATABASE}-${ts}.dump"
log="$BACKUP_DIR/backup.log"

echo "[$ts] starting pg_dump -h $PGHOST -U $PGUSER -d $PGDATABASE -> $out" | tee -a "$log"

if pg_dump -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -Fc -f "$out"; then
    size=$(wc -c <"$out" | tr -d ' ')
    echo "[$ts] pg_dump OK ($size bytes)" | tee -a "$log"
else
    rc=$?
    echo "[$ts] pg_dump FAILED (exit $rc)" | tee -a "$log"
    rm -f "$out"
    exit "$rc"
fi

# Keep only the newest $KEEP dumps for this database.
count=$(ls -1 "$BACKUP_DIR"/"${PGDATABASE}"-*.dump 2>/dev/null | wc -l | tr -d ' ')
if [ "$count" -gt "$KEEP" ]; then
    ls -1t "$BACKUP_DIR"/"${PGDATABASE}"-*.dump | tail -n +"$((KEEP + 1))" | while IFS= read -r old; do
        echo "[$ts] pruning old dump $old" | tee -a "$log"
        rm -f "$old"
    done
fi
