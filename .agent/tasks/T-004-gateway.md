---
id: T-004
title: gateway (Bun + Hono)
owner: claude-sonnet-5 (subagent)
scope: apps/gateway/** (except package.json), .github/workflows/gateway.yml
exit: `cd apps/gateway && bun test && bunx tsc --noEmit` green
phase: plan
blocked:
created: 2026-09-23T1617Z
sprint: S-001
issue: 5
---

## Plan
Public /api/* with the legacy paths and envelope {success,data,timestamp,cached}; forwards to CLIMATE_URL /v1/*; 422 -> 400; hono/cors, secure-headers, body-limit, logger; streamSSE /api/stream from Redis channel ucdt:events; Redis cache (X-Cache) + rate limit (X-RateLimit-*) via Bun.redis; onError/notFound carry CORS header (see Hackathon-BE/src/app.ts). Dockerfile (oven/bun alpine). Tests use a fake climate server + an injectable redis seam.

## Execute
## Review
## Test
## Handoff
