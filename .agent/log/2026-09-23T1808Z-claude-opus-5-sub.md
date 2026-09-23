---
agent: claude-opus-5
session: sub (T-007 subagent)
started: 2026-09-23T1808Z
ended: 2026-09-23T1825Z
scope: services/climate/climate/api/**, services/climate/tests/api/**, packages/contracts/**
branch: feat/T-007-climate-api-contracts
status: done (PR open, awaiting review)
---

## Did
- Built the FastAPI app `climate.api.main:app` with these routes: /v1/{weather,aqi,flood,heat,recommend}/latest, /v1/alerts, POST /v1/alerts/read, POST /v1/simulation, /v1/history/{hazard} and /healthz.
- Wrote pydantic models of the legacy shapes (`climate/api/models.py`). Simulation bounds and error messages come from the ported `validate_scenario`.
- `dump_openapi.py` → packages/contracts/openapi.json → openapi-typescript src/schema.ts; src/index.ts re-exports it.
- Wrote 22 API tests that run against a real DB (`ucdt_test_api`).

## Verified
- `uv run pytest tests/api`: 22 passed. `uv run pytest -q`: 145 passed. ruff check and format are clean. Regenerating gives no diff. The contracts package passes tsc. On uvicorn :8000, curl of healthz, flood, history and simulation all returned the expected responses.

## Bugs
- T-006 stores heat.service's raw heat shape, not the controller shape that legacy /api/heat returned. Against the dev DB, `/v1/heat/latest` returns 500 (see the task Handoff).

## Decisions
- The simulation baseline is the latest weather + flood + aqi snapshots, because legacy runSimulation used all three. Weather alone is not enough.
- Response models validate strictly but allow extra keys. A contract breach shows up as 500/502 instead of being served.

## Not done
- No DB CHECK on alerts type/severity (out of scope).

## Left-next
- T-006 applies the heatController transform; after that, re-curl /v1/heat/latest.
