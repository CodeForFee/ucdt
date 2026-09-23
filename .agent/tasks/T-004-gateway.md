---
id: T-004
title: gateway (Bun + Hono)
owner: claude-sonnet-5 (subagent)
scope: apps/gateway/** (except package.json), .github/workflows/gateway.yml
exit: `cd apps/gateway && bun test && bunx tsc --noEmit` green
phase: review
blocked:
created: 2026-09-23T1617Z
sprint: S-001
issue: 5
---

## Plan
Public /api/* with the legacy paths and envelope {success,data,timestamp,cached}; forwards to CLIMATE_URL /v1/*; 422 -> 400; hono/cors, secure-headers, body-limit, logger; streamSSE /api/stream from Redis channel ucdt:events; Redis cache (X-Cache) + rate limit (X-RateLimit-*) via Bun.redis; onError/notFound carry CORS header (see Hackathon-BE/src/app.ts). Dockerfile (oven/bun alpine). Tests use a fake climate server + an injectable redis seam.

## Execute
Read legacy `Hackathon-BE/src/{app.ts,index.ts,routes/*,controllers/*,middleware/*,types/api.types.ts}` and
`Hackathon-FE/src/shared/{services,lib/axios.ts}` to pin down the exact public contract, then built
`apps/gateway/src/`:
- `redis.ts` — `RedisLike` interface (get/setex/incr/expire/ttl/publish/subscribe/unsubscribe). Bun's real
  `RedisClient` (from `"bun"`) satisfies it structurally, so `index.ts` needs no adapter class; tests inject
  an in-memory fake (`tests/fakes.ts`) with the same shape.
- `climate.ts` — the single place that calls `CLIMATE_URL`: `forward(c, deps, method, path, opts)` wraps a
  bare climate JSON body in `{success,data,timestamp,cached:false}`, and maps climate 404 -> gateway 404
  (legacy shape, no `code`), climate 422 -> 400 with the FastAPI `detail` reduced to one string as `error`,
  unreachable/non-2xx -> 502 `{success:false,error:'Upstream unavailable',code:502,timestamp}`.
- `cache.ts` / `rateLimit.ts` — Redis-backed, GET+200-only cache keyed by full URL (`X-Cache: HIT|MISS`) and
  100 req/min per-IP limiter (INCR+EXPIRE, `X-RateLimit-*`, 429 `{success:false,error:'Too Many
  Requests',retryAfter}` matching legacy exactly). Both fail OPEN (log + serve uncached/unlimited) if any
  Redis call throws.
- `app.ts` — `createApp(deps)` factory. Middleware order: `hono/cors` (static allow-list matching legacy,
  `maxAge:86400`, OPTIONS -> 204 handled by the middleware itself), `hono/secure-headers`, `hono/body-limit`
  (64 KB), `hono/logger`, then the rate limiter. Routes: `/api/{weather,aqi,flood,heat,recommend}` ->
  `GET /v1/<x>/latest` with legacy per-route cache TTLs (300/300/180/300/120s); `/api/alerts` (no cache) and
  `POST /api/alerts/read`; `POST /api/simulation` + `/api/simulation/run` -> `POST /v1/simulation` (body
  forwarded as-is — climate owns validation/defaults); `GET /api/simulation` builds the body from query
  params with the exact legacy `simulationGetController` defaults (50/3/0/0, `cityId` default `'hcmc'`) then
  POSTs; `GET /api/history/:hazard` -> `GET /v1/history/:hazard`; `GET /api/stream` via `streamSSE`,
  subscribing to Redis channel `ucdt:events`, emitting `event: <type>` + `data: <json>`, a `: heartbeat`
  comment every 25 s, and unsubscribing on `stream.onAbort`. `/` and `/health` bodies, the bare 404
  (`{success:false,error:'Not found',path,timestamp}`, no `code`) and the 500 handler reproduce
  `Hackathon-BE/src/app.ts` verbatim; `hono/body-limit`'s `HTTPException` is passed through `onError` via
  `err.getResponse()` so a 413 doesn't get flattened into a 500. Hono's `Context.res` setter merges
  headers set before `next()` into whatever response a later handler/onError creates, so the CORS header set
  by `hono/cors` up front survives onto 404/413/429/502 responses without extra plumbing.
- `index.ts` — `export default {port, hostname:'0.0.0.0', fetch: app.fetch, idleTimeout: 0}` (0 disables
  Bun's idle timeout, needed for long-lived SSE connections), building `createApp` with the real
  `RedisClient` and global `fetch`.
- `Dockerfile` — `oven/bun:1.3-alpine`, standalone `bun install --production` inside `apps/gateway` (the
  package has no `workspace:*` deps — just `hono` — so no monorepo context is needed in the image),
  non-root user, `CMD ["bun","src/index.ts"]`.

Deviation from the plan sketch: dropped the `Bun.redis` global singleton in favor of constructing a
`RedisClient` explicitly in `index.ts` — same effect, but keeps `REDIS_URL` handling in one place instead of
relying on an env var Bun reads implicitly.

## Review
Self-review: verified with a live `bun run src/index.ts` (no Postgres/Redis/climate running) that the server
boots and fails open — `/health` and `/` respond normally, `GET /api/weather` returns `502
{success:false,error:'Upstream unavailable',code:502,...}` with `Access-Control-Allow-Origin: *` and the
rate-limit headers present even though Redis was never started, and `GET /api/stream` returns `200
text/event-stream` immediately (subscribe failure logged, connection stays open) instead of hanging or
crashing.

## Test
`bun test` — 25 pass / 0 fail across 5 files (`tests/{gateway,simulation,cache,rate-limit,stream}.test.ts`),
covering: legacy envelope + query passthrough; 404 (both gateway-native and climate-relayed) and 500 shapes
with no `code` field; climate 422 -> 400 with the validation message as `error`; climate-unreachable and
climate-5xx -> 502; CORS header present on 404/502/OPTIONS responses; `/` and `/health` bodies; alerts +
history forwarding; `GET /api/simulation` query->body conversion (both defaulted and fully-specified);
cache MISS-then-HIT (upstream hit once) keyed per full URL, POST never cached, cache fails open when Redis
is down; rate limit 200 x100 then 429 on request 101 (with `X-RateLimit-Remaining: 0` on the 100th), a
second IP unaffected, fails open when Redis is down; SSE delivers a `redis.publish('ucdt:events', ...)`
message to a connected client as `event: <type>` + matching `data:`.

```
$ cd apps/gateway && bun test
 25 pass
 0 fail
 58 expect() calls
Ran 25 tests across 5 files. [62.00ms]

$ bunx tsc --noEmit
(no output — clean)
```

## Handoff
Scope respected: only `apps/gateway/**` (minus `package.json`) and `.github/workflows/gateway.yml` touched.
Nothing added to `dependencies` — implementation uses only `hono` (already in package.json), Bun 1.3.14
built-ins (`RedisClient`, global `fetch`), and TypeScript.

Known ceilings / follow-ups for whoever owns T-007 (climate-api) and T-012 (CI/GHCR):
- The climate service doesn't exist yet (T-007 is still `plan`), so `climate.ts`'s 422-body parsing assumes
  FastAPI's default `{"detail": [...]}` validation-error shape. If climate ships a different error body,
  `extractValidationMessage` in `src/climate.ts` is the one place to adjust.
- `GET /api/simulation`'s query->body defaults (50 mm rainfall / 3 h / 0% green / 0% traffic / `cityId:
  'hcmc'`) are copied from the legacy `simulationGetController` verbatim per the task spec, even though the
  gateway otherwise never encodes a domain default — flagged here so it isn't mistaken for scope creep.
- `.github/workflows/gateway.yml` now runs `bun test` and `bunx tsc --noEmit` in `apps/gateway`; T-012 can
  extend this job with the GHCR build/push step without touching what's here.
- Dockerfile installs the gateway's `hono` dependency standalone (no `workspace:*` deps exist to link), so
  it does not depend on the root `pnpm-lock.yaml` — worth re-checking if a shared internal package is added
  to gateway's `package.json` later.
