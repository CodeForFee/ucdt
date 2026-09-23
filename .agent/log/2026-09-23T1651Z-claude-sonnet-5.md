---
task: T-004
agent: claude-sonnet-5
started: 2026-09-23T1651Z
---

## Task
T-004 (issue #5) — build the gateway: a Bun + Hono public API that is the ONLY thing the legacy frontend
talks to. It forwards to the internal climate service at `CLIMATE_URL` and wraps bare climate JSON in the
legacy `{success,data,timestamp,cached}` envelope, reproducing `Hackathon-BE`'s public contract exactly
(paths, error shapes, `/` and `/health` bodies, cache TTLs, rate-limit headers, CORS incl. on errors, OPTIONS
204). Scope: `apps/gateway/**` (except `package.json`) + `.github/workflows/gateway.yml`.

## Did
- Read `Hackathon-BE/src/{app.ts,index.ts,routes/*,controllers/*,middleware/*,types/api.types.ts}` and
  `Hackathon-FE/src/shared/{services,lib/axios.ts}` to pin the exact contract (including a legacy quirk:
  `app.notFound`/`app.onError` omit the `code` field that `createApiError` otherwise always includes).
- Built `apps/gateway/src/{redis,cache,rateLimit,climate,app,index}.ts`: `RedisLike` interface satisfied
  structurally by Bun's real `RedisClient` (no adapter class needed); Redis-backed cache (GET+200 only, keyed
  by full URL, per-route TTL) and rate limit (100/min/IP, INCR+EXPIRE) that both fail OPEN on a Redis error;
  a single `forward()` helper in `climate.ts` that is the only code touching `CLIMATE_URL` and owns the
  404/422->400/502 mapping; `createApp(deps)` factory wiring `hono/cors` + `hono/secure-headers` +
  `hono/body-limit(64KB)` + `hono/logger` + the rate limiter, then every route from the task's route map
  including `GET /api/stream` (SSE from Redis channel `ucdt:events`, 25s heartbeat, clean unsubscribe on
  `stream.onAbort`).
- `Dockerfile` (`oven/bun:1.3-alpine`, standalone `bun install --production` — gateway has no `workspace:*`
  deps — non-root user) + `.dockerignore`.
- 25 tests across 5 files (`tests/{gateway,simulation,cache,rate-limit,stream}.test.ts` + a shared
  `tests/fakes.ts` for the in-memory Redis fake and a fake `climateFetch`), covering every item the task
  listed: envelope/error/404 shapes, 422->400, 502 on upstream failure, `GET /api/simulation` query->body
  conversion, cache HIT/MISS, 429 at request 101, CORS on error responses, SSE delivery.
- Added `bun test` + `bunx tsc --noEmit` (working-directory `apps/gateway`) to `.github/workflows/gateway.yml`
  — job name `gateway` unchanged, no path filter added.
- Live-smoke-tested `bun run src/index.ts` with no Postgres/Redis/climate running: boots clean, `/health`
  and `/` respond, `GET /api/weather` correctly fails to `502 Upstream unavailable` with CORS + rate-limit
  headers present, `GET /api/stream` returns `200 text/event-stream` immediately instead of hanging.

## Verified
```
$ cd apps/gateway && bun test
 25 pass
 0 fail
 58 expect() calls
Ran 25 tests across 5 files. [62.00ms]

$ bunx tsc --noEmit
(no output — clean)
```

## Not done
- Did not implement or stub the climate service itself (T-007, still `plan`) — `climate.ts`'s 422 parsing is
  written against FastAPI's default validation-error shape (`{"detail":[...]}`) since that's what
  `services/climate/pyproject.toml` declares as the framework; unverified against a real climate response
  because none exists yet.
- No GHCR build/push step — task scope stops at the Dockerfile; wiring it into CI is T-012.

## Left / next
- Task file `.agent/tasks/T-004-gateway.md` updated to `phase: review` with Execute/Review/Test/Handoff
  filled in.
- PR opened into `dev` per the team's git flow; tech lead review + squash-merge + issue close is next, not
  done by this agent.
- Flagged in the task file's Handoff section for whoever builds T-007: if climate's actual 422 body differs
  from FastAPI's default shape, `extractValidationMessage` in `src/climate.ts` is the one place to fix.
