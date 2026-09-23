#!/bin/sh
# POSIX sh. Container entrypoint for the `backup` service: runs backup.sh once immediately
# (so a fresh deploy has a dump within minutes, not a day) and then every 24h. A failed run
# is logged and retried at the next interval instead of crashing the container.
set -eu

DIR="$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)"

while true; do
    "$DIR/backup.sh" || echo "backup.sh failed, will retry in 24h" >&2
    sleep 86400
done
