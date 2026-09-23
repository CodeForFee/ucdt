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

### Review fixes (PR #37 round 1)
- **Exec bit**: all four scripts were committed `100644`. Docker Desktop on Windows reports every bind-mounted file as executable regardless of the git mode, which is why the first round's local verification didn't catch it — a real Linux host (or `git archive` piped into a container, bypassing the bind-mount) would hit `Permission denied`, exit 126. Fixed with `git update-index --chmod=+x` on all four; re-verified by writing the *staged* tree to a git tree object (`git write-tree` — `git archive HEAD` alone still shows the old mode pre-commit) and running it in a bare `alpine` container.
- **`restore.sh` couldn't restore a database with active connections** (`dropdb` refuses while `climate-api`/`climate-worker`/`backup` hold connections to it). Fixed: resolves `infra/compose.yml` + `infra/compose.prod.yml` relative to the script's own location (works from any CWD); stops `climate-api climate-worker backup` before the drop; `dropdb --force` as a backstop (also covers a stray human `psql` session); restarts those services after, via a `trap ... EXIT` so a failed restore still leaves them running. Kept the typed-name confirmation. Added `RESTORE_DRY_RUN=1` (prints the `docker compose stop`/`start` commands instead of running them) so the stop/start path can be exercised against a scratch database without touching the live stack's `climate-api`/`climate-worker` — see Test for how this was actually proven under connection contention.
- `docs/DEPLOY.md`'s restore section rewritten to describe the new stop → force-drop → restore → restart sequence and `RESTORE_DRY_RUN`.

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

### Review fixes (PR #37 round 1) — verified
```
# 1. exec bit, reproducing the reviewer's own repro (staged tree, not a bind mount):
$ git update-index --chmod=+x infra/deploy.sh infra/backup/backup.sh infra/backup/entrypoint.sh infra/backup/restore.sh
$ git write-tree
fc1220ef652790351516b566724c0b28af38273c
$ git archive fc1220ef... infra/backup infra/deploy.sh -o t013-archive.tar && tar tvf t013-archive.tar
-rwxrwxr-x ... infra/backup/backup.sh / entrypoint.sh / restore.sh, infra/deploy.sh   # all 755

$ docker run --rm -v "$(pwd)/t013-archive.tar:/archive.tar:ro" alpine sh -c \
    'mkdir /r && tar xf /archive.tar -C /r && timeout 5 /r/infra/backup/entrypoint.sh; echo EXIT=$?'
[20260923T234949Z] starting pg_dump -h postgres -U ucdt -d ucdt -> /backups/ucdt-20260923T234949Z.dump
/r/infra/backup/backup.sh: line 28: pg_dump: not found      # bare alpine has no pg client -- expected
[20260923T234949Z] pg_dump FAILED (exit 127)
backup.sh failed, will retry in 24h
Terminated
EXIT=143                                                     # killed by `timeout 5`, NOT "Permission denied"/126

# 2. restore.sh under connection contention, against the scratch DB, without stopping the live stack:
$ docker exec ucdt-postgres-1 createdb -U ucdt ucdt_restore_test
$ docker exec -d ucdt-postgres-1 psql -U ucdt -d ucdt_restore_test -c "select pg_sleep(60);"
$ docker exec ucdt-postgres-1 psql -U ucdt -d ucdt -c \
    "select pid, state, query from pg_stat_activity where datname='ucdt_restore_test';"
 pid=26150 | active | select pg_sleep(60);          # connection confirmed held

$ POSTGRES_CONTAINER=ucdt-postgres-1 RESTORE_DRY_RUN=1 sh infra/backup/restore.sh \
    infra/backup/.dumptest2/ucdt-20260923T235218Z.dump ucdt_restore_test <<< "ucdt_restore_test"
restore.sh: stopping climate-api climate-worker backup
[dry-run] docker compose -f .../infra/compose.yml -f .../infra/compose.prod.yml stop climate-api climate-worker backup
restore.sh: restored .../ucdt-20260923T235218Z.dump into database 'ucdt_restore_test'
restore.sh: starting climate-api climate-worker backup back up
[dry-run] docker compose -f .../infra/compose.yml -f .../infra/compose.prod.yml start climate-api climate-worker backup
restore.sh exit=0                                             # succeeded despite the held connection

$ docker exec ucdt-postgres-1 psql -U ucdt -d ucdt_restore_test -c "select count(*) from spatial_units;"
 count = 63
$ docker exec ucdt-postgres-1 psql -U ucdt -d ucdt -c "select pid, state from pg_stat_activity where pid=26150;"
(0 rows)                                                       # the sleeping connection is gone -- dropdb --force worked
$ docker ps --format "{{.Names}}: {{.Status}}" | grep ucdt
ucdt-climate-api-1: Up 5 hours (healthy), ucdt-climate-worker-1: Up 5 hours    # never actually stopped (dry-run)

# confirmation-mismatch still aborts cleanly, before touching docker/compose/postgres:
$ POSTGRES_CONTAINER=ucdt-postgres-1 RESTORE_DRY_RUN=1 sh infra/backup/restore.sh /etc/hosts wrongdb <<< "typo"
restore.sh: confirmation did not match, aborting
exit=1

# cleanup: dropped ucdt_restore_test, removed local .dumptest*/t013-archive.tar, confirmed
# live `ucdt` DB still has 63 spatial_units and all 6 containers unchanged throughout.
```
Note: `RESTORE_DRY_RUN=1` was necessary specifically to avoid stopping `climate-api`/`climate-worker` (part of the user's running stack, off-limits per the review comment); the `dropdb --force` fix — the actual bug — was exercised for real under genuine connection contention.

## Handoff
Merge-ready for the tech lead. `infra/uptime/**` was left empty (in-scope but unneeded — uptime-kuma needs no extra files). Open item for the user: `docker login ghcr.io` and the actual VPS hardening/deploy run happen on the real VPS, which this session never touches (no SSH) — DEPLOY.md documents every command but none of it has been run against a real VPS.
