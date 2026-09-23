---
id: T-010
title: full-stack compose + Caddy
owner: claude-opus-5
scope: infra/** (except files owned by T-013)
exit: `docker compose -f infra/compose.yml up -d --build` -> all pages at http://localhost, SSE live, legacy FE works against new gateway, docker stats total < 1.2 GB
phase: done
blocked:
created: 2026-09-23T1617Z
sprint: S-001
issue: 12
---

## Plan
6 services, only Caddy publishes ports. Caddyfile: /api/* -> gateway (flush_interval -1), else SPA try_files + zstd/gzip. web.Dockerfile builds Vite into the Caddy image.

## Execute
- `infra/compose.yml`: postgres, redis, migrate (one-shot `alembic upgrade head`), climate-api, climate-worker (one image `ucdt/climate:local` via a YAML anchor), gateway, caddy. Only caddy publishes 80/443(+udp). Healthchecks gate the start order: postgres → migrate (completed) → api (healthy /healthz) → gateway (healthy /health) → caddy. mem_limit: pg 512m, redis 96m, api/worker/migrate 256m, gateway/caddy 128m.
- `infra/Caddyfile`: `/api/*` → gateway:3001 with `flush_interval -1` and NO encode (compressing SSE buffers it); SPA with `try_files {path} /index.html`, zstd/gzip, immutable cache on /assets. `SITE_ADDRESS` (:80 default; a domain → auto HTTPS).
- `infra/web.Dockerfile`: node 22 + corepack pnpm, `pnpm install --frozen-lockfile --filter web...`, Vite build with VITE_* build args → caddy:2-alpine.
- Root `.dockerignore` (web + gateway build from the repo root): node_modules, dist, .venv, .git, .claude, .agent, env files.
- `VITE_MAPBOX_TOKEN` is required at build (`${VITE_MAPBOX_TOKEN:?...}`): apps/web/src/config/env.ts throws at startup without it, so a build without one would ship a blank app.
- Out of infra scope (lead): worker log now carries the HTTP status of a failed upstream fetch (never the URL — fallback AQ URLs carry API keys); README gains the whole-stack commands.

## Review
- A transient Open-Meteo HTTP error on the 19:00 cron (30 s after the startup run) skipped that run; a manual fetch from the container right after succeeded 3/3. Design is right (keep last good snapshots, stale after 45 min); the log just lacked the status code — fixed.

## Test
```
docker compose -f infra/compose.yml up -d --build --wait
  -> postgres, redis, climate-api, gateway, caddy healthy; climate-worker running; migrate Exited (0)
curl http://localhost/api/{weather,aqi,flood,heat,recommend,alerts,history/flood?hours=2} -> all 200
curl http://localhost/ and /simulation/heat -> 200 text/html; Content-Encoding: zstd; /assets/* Cache-Control immutable
curl -N http://localhost/api/stream + redis-cli PUBLISH ucdt:events ... -> both events arrive immediately
browser http://localhost: dashboard, map (flood polygons + AQI markers, real token), simulation/heat (POST 200);
  PUBLISH alert.created -> second GET /api/alerts without reload
legacy Hackathon-FE `NEXT_PUBLIC_API_BASE_URL=http://localhost pnpm dev -p 3100`: dashboard, 6 endpoints 200,
  simulation Run -> OPTIONS 204 + POST /api/simulation/run 200, no console errors
docker stats: caddy 16 + gateway 23 + worker 66 + api 66 + redis 9 + postgres 32 ≈ 213 MiB
uv run pytest -q -> 166 passed
```

## Handoff
T-013 owns deploy.sh/backup/uptime under infra/. To bring the dev loop back after a full-stack run: `docker compose -f infra/compose.yml -f infra/compose.dev.yml up -d postgres redis`.
