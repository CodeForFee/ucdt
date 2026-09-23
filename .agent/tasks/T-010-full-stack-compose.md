---
id: T-010
title: full-stack compose + Caddy
owner: claude-opus-5
scope: infra/** (except files owned by T-013)
exit: `docker compose -f infra/compose.yml up -d --build` -> all pages at http://localhost, SSE live, legacy FE works against new gateway, docker stats total < 1.2 GB
phase: plan
blocked:
created: 2026-09-23T1617Z
sprint: S-001
issue: 12
---

## Plan
6 services, only Caddy publishes ports. Caddyfile: /api/* -> gateway (flush_interval -1), else SPA try_files + zstd/gzip. web.Dockerfile builds Vite into the Caddy image.

## Execute
## Review
## Test
## Handoff
