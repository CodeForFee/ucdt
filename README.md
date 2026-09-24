# UCDT — Urban Climate Digital Twin (v2)

Monorepo for the PO-UCDT prototype: flood, heat and air-quality risk for Ho Chi Minh City,
with what-if simulation and rule-based recommendations.

```
Internet ─► Caddy :80/:443 ─┬─ /        → web (static Vite build)
                            └─ /api/*   → gateway (Bun + Hono)
                                            │ internal HTTP        ▲ SSE ← Redis pub/sub
                                            ▼                      │
                                   climate-api (FastAPI) ──► Postgres 16 + PostGIS
                                   climate-worker (arq)  ──► Redis 7
```

| Path | What | Stack |
|---|---|---|
| `services/climate` | Data + processing layer: ingestion every 15 min, **all PDIM coefficients and formulas**, snapshots, alerts, recommendations, simulation, DB schema | Python 3.12, uv, FastAPI, arq, SQLAlchemy, Alembic |
| `apps/gateway` | Public `/api/*`: envelope, cache, rate limit, SSE, CORS. Never touches the DB, never computes | Bun, Hono |
| `apps/web` | Presentation layer. Never computes a value the climate service owns | Vite, React 19, TanStack Query, react-router, Mapbox GL |
| `packages/contracts` | TypeScript types generated from the climate OpenAPI schema | openapi-typescript |
| `infra` | docker compose, Caddy | |
| `tools/gen-parity.ts` | Golden fixture from the legacy TS backend, for numeric parity of the Python port | tsx |

## Develop

Prerequisites: Node ≥ 22 + pnpm, Bun ≥ 1.3, uv, Docker.

```bash
pnpm install                                                     # web, gateway, contracts
(cd services/climate && uv sync)                                 # climate
docker compose -f infra/compose.yml -f infra/compose.dev.yml up -d postgres redis   # postgres + redis on 127.0.0.1
```

Whole stack, as it runs on the VPS (only Caddy publishes ports; http://localhost):

```bash
cp infra/.env.example infra/.env          # set VITE_MAPBOX_TOKEN (required) and POSTGRES_PASSWORD
docker compose -f infra/compose.yml up -d --build
```

## Working agreement

- One task = one GitHub issue = one branch `feat/T-NNN-<slug>` = one PR into `dev`. `dev` only moves through reviewed PRs; `main` is promoted from `dev` by the maintainer.
- Every PR states its scope, exit condition and the verify command with its output (see the PR template).
- Shared agent state lives in `.agent/`: `BOARD.md` (claims, bugs, decisions), `sprints/`, `tasks/` (one file per task), `log/` (one file per session).
