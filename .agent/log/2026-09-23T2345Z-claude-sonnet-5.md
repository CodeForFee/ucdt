# 2026-09-23T2345Z claude-sonnet-5 — T-013 deploy + backup + DEPLOY.md (#14)

Branch `feat/T-013-deploy-backup-docs` off `origin/dev`. Scope: `infra/deploy.sh`,
`infra/compose.prod.yml` (new), `infra/backup/**`, `docs/DEPLOY.md`.

## What was done
- `infra/compose.prod.yml`: production override for `infra/compose.yml` — GHCR images
  (`ghcr.io/codeforfee/ucdt-{climate,gateway,web}:${UCDT_TAG:-main}`) for migrate/climate-api/
  climate-worker/gateway/caddy; `backup` service (postgres:16-alpine, daily pg_dump -Fc, keep 7,
  64m mem_limit); `uptime-kuma` on `127.0.0.1:3100` only, 200m mem_limit.
- `infra/backup/backup.sh` (one dump + prune), `infra/backup/entrypoint.sh` (daily loop),
  `infra/backup/restore.sh <dump> [db]` (host-side, `docker exec` into postgres, confirm-by-name
  guard against restoring over the wrong DB).
- `infra/deploy.sh`: refuses without `infra/.env`, `git pull --ff-only`, compose pull + `up -d
  --no-build --remove-orphans --wait`, prints health, prunes images, honours `UCDT_TAG` rollback.
- `docs/DEPLOY.md` (Vietnamese): prereqs, hardening checklist, private-repo clone, GHCR login,
  `.env` setup, deploy/update/rollback, backups (off-box copy + restore), Uptime Kuma via SSH
  tunnel with monitor suggestions, troubleshooting.

## Verified
- `bash -n` / `sh -n` clean on all four scripts.
- `shellcheck` (via `koalaman/shellcheck:stable` in Docker) clean except two SC2012 info notices
  in `backup.sh` (ls vs find on our own timestamped filenames — not a real risk here).
- `VITE_MAPBOX_TOKEN=pk.x docker compose -f infra/compose.yml -f infra/compose.prod.yml config -q`
  exits 0; confirmed the five services resolve to the right GHCR image + tag.
- Real dump-and-restore against the local stack that was already running (7 containers, started
  by another session): ran `infra/backup/backup.sh` in a scratch `postgres:16-alpine` container on
  the `ucdt_default` network, produced a 262,882-byte `.dump`; restored it into a throwaway
  `ucdt_restore_test` database via `docker exec` (`createdb` + `pg_restore --no-owner`);
  `select count(*) from spatial_units` = 63. Dropped `ucdt_restore_test` afterwards and confirmed
  the live `ucdt` database still reports 63 rows and all 6 stack containers are still `Up`
  untouched.

## Deviations / open questions
- `infra/compose.yml`'s `caddy` build arg `VITE_MAPBOX_TOKEN` is a *required* Compose
  interpolation, so it must be non-empty in `infra/.env` even in prod (where that image is
  pulled, not built) — flagged in DEPLOY.md's troubleshooting section rather than touched (that
  file is out of my scope).
- `infra/uptime/**` was granted in scope but left empty: `uptime-kuma` needs no extra files
  beyond the compose service definition.
- Nothing here was run against a real VPS or GHCR (no SSH, no `docker login` performed) — every
  VPS/GHCR step in DEPLOY.md is written but unproven against a real box, which the user runs.
