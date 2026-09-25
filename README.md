# UCDT — Urban Climate Digital Twin (v2)

[![climate](https://github.com/CodeForFee/ucdt/actions/workflows/climate.yml/badge.svg?branch=main)](https://github.com/CodeForFee/ucdt/actions/workflows/climate.yml)
[![gateway](https://github.com/CodeForFee/ucdt/actions/workflows/gateway.yml/badge.svg?branch=main)](https://github.com/CodeForFee/ucdt/actions/workflows/gateway.yml)
[![web](https://github.com/CodeForFee/ucdt/actions/workflows/web.yml/badge.svg?branch=main)](https://github.com/CodeForFee/ucdt/actions/workflows/web.yml)
[![images](https://github.com/CodeForFee/ucdt/actions/workflows/images.yml/badge.svg?branch=main)](https://github.com/CodeForFee/ucdt/actions/workflows/images.yml)

Monorepo for the PO-UCDT prototype: flood, heat and air-quality risk for Ho Chi Minh City,
with what-if simulation and rule-based recommendations, built on a transparent, single-source
formula base (§4.2 of the PO-UCDT manuscript) rather than an opaque model.

**Live:** [po-ucdt.top](https://po-ucdt.top)

## Architecture

```
                                   ┌─ gateway  ─┐
Internet ─► nginx :80/:443 ─┬─ /        → web (static Vite build)      │  cache · rate limit
                             └─ /api/* ─►┤            (Bun + Hono)      │  SSE via Redis pub/sub
                                         └─ gateway2 ─┘                 │  (B-013: shared Redis,
                                              │ internal HTTP           ▼   no session affinity)
                                              ▼
                                    climate-api (FastAPI) ──► Postgres 16 + PostGIS
                                    climate-worker (arq)  ──► Redis 7
```

nginx terminates TLS (Let's Encrypt via certbot, `infra/certbot/`) and load-balances across two
stateless gateway replicas. `climate-worker` refreshes weather/AQI/flood/heat snapshots every
15 minutes; the web app subscribes to live updates over SSE.

| Path | What | Stack |
|---|---|---|
| `services/climate` | Data + processing layer: ingestion every 15 min, **all PDIM coefficients and formulas**, snapshots, alerts, recommendations, simulation, DB schema | Python 3.12, uv, FastAPI, arq, SQLAlchemy, Alembic |
| `apps/gateway` | Public `/api/*`: envelope, cache, rate limit, SSE, CORS. Never touches the DB, never computes | Bun, Hono |
| `apps/web` | Presentation layer. Never computes a value the climate service owns | Vite, React 19, TanStack Query, react-router, Mapbox GL |
| `packages/contracts` | TypeScript types generated from the climate OpenAPI schema | openapi-typescript |
| `infra` | Docker Compose, nginx + certbot, backup, Uptime Kuma — see [`docs/DEPLOY.md`](docs/DEPLOY.md) | |
| `tools/gen-parity.ts` | Golden fixture from the legacy TS backend, for numeric parity of the Python port | tsx |

## Develop

Prerequisites: Node ≥ 22 + pnpm, Bun ≥ 1.3, uv, Docker.

```bash
pnpm install                                                     # web, gateway, contracts
(cd services/climate && uv sync)                                 # climate
docker compose -f infra/compose.yml -f infra/compose.dev.yml up -d postgres redis   # postgres + redis on 127.0.0.1
```

Whole stack, as it runs on the VPS (only nginx publishes ports; https://localhost):

```bash
cp infra/.env.example infra/.env          # set VITE_MAPBOX_TOKEN (required) and POSTGRES_PASSWORD
docker compose -f infra/compose.yml up -d --build
```

## CI/CD

Every push runs the matching test workflow (`climate.yml`, `gateway.yml`, `web.yml`); `images.yml`
then builds `ucdt-{climate,gateway,web}` and, on `main`/`dev` pushes only, publishes them to
`ghcr.io/codeforfee/*` tagged by branch, `sha-<short>` and `latest` (on `main`).

**Deployment to the VPS is a manual step, not an automatic pipeline step**: after `main` is
promoted, `infra/deploy.sh` is run on the VPS (`git pull` + `docker compose pull` + `up -d`) —
see [`docs/DEPLOY.md`](docs/DEPLOY.md) for the full runbook, rollback and HTTPS bootstrap.

## Working agreement

- One task = one GitHub issue = one branch `feat/T-NNN-<slug>` = one PR into `dev`. `dev` only moves through reviewed PRs, merged with a real merge commit (not squash — squashing breaks `main`'s ancestry the next time it's promoted from `dev`); `main` is promoted from `dev` by the maintainer.
- Every PR states its scope, exit condition and the verify command with its output (see the PR template).
- Shared agent state lives in `.agent/`: `BOARD.md` (claims, bugs, decisions), `sprints/`, `tasks/` (one file per task), `log/` (one file per session).
