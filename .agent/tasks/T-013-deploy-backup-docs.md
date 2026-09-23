---
id: T-013
title: deploy + backup + DEPLOY.md
owner: claude-sonnet-5 (subagent)
scope: infra/{deploy.sh,backup/**,uptime/**}, docs/DEPLOY.md
exit: `bash -n infra/deploy.sh`; `docker compose config` validates with the backup service; DEPLOY.md covers the hardening checklist
phase: review
blocked:
created: 2026-09-23T1617Z
sprint: S-001
issue: 14
---

## Plan
deploy.sh (git pull, compose pull, up -d), daily pg_dump keep 7, Uptime Kuma, VPS hardening (non-root user + key, no root/password SSH, ufw 22/80/443). The user runs it on the VPS; agents never SSH.

## Execute
- `infra/compose.prod.yml` (new override, used with `infra/compose.yml`): `image: ghcr.io/codeforfee/ucdt-<x>:${UCDT_TAG:-main}` for migrate/climate-api/climate-worker (via a `climate-image` YAML anchor), gateway and caddy — base `build:` stays (Compose merges, doesn't delete), so `deploy.sh`'s `up -d --no-build` uses the pulled image without needing to touch `infra/compose.yml`. `backup` service: `postgres:16-alpine` (matches the running server's major version), `mem_limit: 64m`, bind-mounts `${BACKUP_DIR:-/var/backups/ucdt}` (host) to `/backups` and `infra/backup/` (read-only) to `/backup`, entrypoint `/backup/entrypoint.sh`. `uptime-kuma` (`louislam/uptime-kuma:1`, `mem_limit: 200m`) published only on `127.0.0.1:3100`, own named volume.
- `infra/backup/backup.sh` — POSIX sh: `pg_dump -Fc` to `$BACKUP_DIR/<db>-<UTC timestamp>.dump`, logs start/OK/FAILED to stdout and `$BACKUP_DIR/backup.log`, prunes to the newest `$KEEP` (default 7) dumps for that database. Also runnable standalone for a one-off dump.
- `infra/backup/entrypoint.sh` — the `backup` service's container command: runs `backup.sh` once immediately, then every 24h; a failed run is logged and retried next interval instead of crashing the container.
- `infra/backup/restore.sh <dumpfile> [database]` — runs on the host (shells out to `docker exec` against `${POSTGRES_CONTAINER:-ucdt-postgres-1}`), warns clearly that it drops/recreates the target database, requires typing the database name back to confirm, then `dropdb`+`createdb`+`pg_restore --no-owner`. Defaults to `ucdt` but takes any database name as arg 2 — used against a scratch DB for verification (see Test) so it never has to touch the live database in normal use.
- `infra/deploy.sh` — bash, `set -euo pipefail`: refuses to run without `infra/.env`, `git pull --ff-only`, `compose -f compose.yml -f compose.prod.yml pull` (honours `UCDT_TAG` for rollback), `up -d --no-build --remove-orphans --wait`, prints `compose ps`, `docker image prune -f`.
- `docs/DEPLOY.md` (Vietnamese) — VPS prerequisites + Docker install, full hardening checklist (non-root sudo user + SSH key, `PermitRootLogin no`/`PasswordAuthentication no`, `ufw` 22/80/443, unattended-upgrades, fail2ban optional), cloning the private repo (deploy key or PAT), `docker login ghcr.io` (PAT `read:packages`), `infra/.env` setup (including why `VITE_MAPBOX_TOKEN` must still be set even though prod doesn't build — `infra/compose.yml`'s required-var check runs regardless), first deploy / updates / rollback via `UCDT_TAG`, backups (location, copying off-box, restore), Uptime Kuma via SSH tunnel with suggested monitors (`/`, `/api/weather`), troubleshooting table.
- Did not create `infra/uptime/**` — no extra files needed beyond the compose service (image-based, no custom Dockerfile/config); left the directory out rather than adding an empty scaffold.

## Review
No deviations from the task file's scope. One thing worth flagging: `infra/compose.yml`'s `caddy.build.args.VITE_MAPBOX_TOKEN` is a *required* interpolation (`${VITE_MAPBOX_TOKEN:?...}`), so `docker compose config`/`pull`/`up` on `infra/compose.prod.yml` still fails without a non-empty `VITE_MAPBOX_TOKEN` in `infra/.env`, even though prod never builds that image. This is existing behaviour in a file I must not edit (`infra/compose.yml`) — documented as the first troubleshooting entry in DEPLOY.md instead of changing it.

## Test
```
$ bash -n infra/deploy.sh && sh -n infra/backup/backup.sh && sh -n infra/backup/entrypoint.sh && sh -n infra/backup/restore.sh
OK (all four)

$ docker run --rm -v "$(pwd)/infra:/mnt/infra:ro" koalaman/shellcheck:stable /mnt/infra/deploy.sh /mnt/infra/backup/*.sh
Only SC2012 (info): "Use find instead of ls" x2 in backup.sh (filenames are our own
UTC-timestamped dumps, not adversarial input) — no warnings/errors.

$ VITE_MAPBOX_TOKEN=pk.x docker compose -f infra/compose.yml -f infra/compose.prod.yml config -q
(exit 0)
$ VITE_MAPBOX_TOKEN=pk.x docker compose -f infra/compose.yml -f infra/compose.prod.yml config | grep image:
  -> migrate/climate-api/climate-worker: ghcr.io/codeforfee/ucdt-climate:main
  -> gateway: ghcr.io/codeforfee/ucdt-gateway:main
  -> caddy: ghcr.io/codeforfee/ucdt-web:main
  -> backup: postgres:16-alpine · uptime-kuma: louislam/uptime-kuma:1

# Real backup + restore against the already-running local stack (7 services up, untouched):
$ docker run --rm --network ucdt_default \
    -e PGHOST=postgres -e PGUSER=ucdt -e PGPASSWORD=ucdt -e PGDATABASE=ucdt -e BACKUP_DIR=/backups -e KEEP=7 \
    -v "$(pwd)/infra/backup/.dumptest:/backups" -v "$(pwd)/infra/backup:/backup:ro" \
    postgres:16-alpine /backup/backup.sh
[...] pg_dump OK (262882 bytes)  -> infra/backup/.dumptest/ucdt-20260923T234313Z.dump

$ docker cp infra/backup/.dumptest/ucdt-20260923T234313Z.dump ucdt-postgres-1:/tmp/restore_test.dump
$ docker exec ucdt-postgres-1 createdb -U ucdt ucdt_restore_test
$ docker exec ucdt-postgres-1 pg_restore -U ucdt -d ucdt_restore_test --no-owner /tmp/restore_test.dump
(exit 0)
$ docker exec ucdt-postgres-1 psql -U ucdt -d ucdt_restore_test -c "select count(*) from spatial_units;"
 count
-------
    63
(1 row)

# cleanup, and proof the live DB was never touched:
$ docker exec ucdt-postgres-1 dropdb -U ucdt ucdt_restore_test
$ docker exec ucdt-postgres-1 psql -U ucdt -d ucdt -c "select count(*) from spatial_units;"
 count
-------
    63
(1 row)
$ docker ps --format "{{.Names}}: {{.Status}}" | grep ucdt   # all 6 services still Up, unchanged
```

## Handoff
Merge-ready for the tech lead. `infra/uptime/**` was left empty (in-scope but unneeded — uptime-kuma needs no extra files). Open item for the user: `docker login ghcr.io` and the actual VPS hardening/deploy run happen on the real VPS, which this session never touches (no SSH) — DEPLOY.md documents every command but none of it has been run against a real VPS.
