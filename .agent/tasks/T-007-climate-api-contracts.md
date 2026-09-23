---
id: T-007
title: climate-api + contracts
owner: claude-opus-5 (subagent)
scope: services/climate/climate/api/**, services/climate/tests/api/**, packages/contracts/**
exit: `uv run pytest tests/api` green; `pnpm -F @ucdt/contracts gen` produces types with no diff
phase: review
blocked:
created: 2026-09-23T1617Z
sprint: S-001
issue: 9
---

## Plan
FastAPI internal API: GET /v1/{weather,aqi,flood,heat,recommend}/latest (+observedAt, stale > 45 min), GET /v1/alerts, POST /v1/alerts/read, POST /v1/simulation (pydantic bounds = legacy validateScenario), GET /v1/history/{hazard}?hours=, GET /healthz. Response models match legacy shapes. dump_openapi -> packages/contracts/openapi.json -> openapi-typescript.

## Execute
- `climate/api/main.py`: FastAPI `app`. `/v1/{hazard}/latest` = stored `result` + `observedAt` (js_iso of computed_at) + `stale` (> `stale_after_minutes`); no snapshot → 503 `{"detail":"no snapshot yet"}`. `/v1/alerts` (web `AlertsResponse`); `POST /v1/alerts/read` `{ids}` (1..1000 strings) → `{marked}` = rows actually changed. `POST /v1/simulation`: `run_simulation` on the latest **weather + flood + aqi** snapshots (what legacy runSimulation fetched), id `sim-<ms>-<n>`. `/v1/history/{hazard}?hours=1..168` (unknown hazard → 404). `/healthz` → `SELECT 1`. One transaction per request (`get_session`). Unknown query params (lat/lng/city/cityId) are ignored.
- `climate/api/models.py`: pydantic models of the legacy `data` shapes. Response models are `extra="allow"` so a stored result is served whole. `Scenario` runs the ported `validate_scenario` in a before-validator → legacy error text in `detail[].msg` (the gateway surfaces it as the 400 `error`); null/omitted levers take the legacy defaults (50/3/0/0); bools/strings are rejected like `Number.isFinite`.
- `climate/api/dump_openapi.py` → `packages/contracts/openapi.json`; `gen` → `src/schema.ts` (added `--default-non-nullable false` so request fields with defaults stay optional); `src/index.ts` re-exports. Operation ids = function names (`latest_flood`, `simulate`, ...).

## Review
- Response validation is strict on purpose: a snapshot that breaks the contract is a 500 (gateway 502), not silently reshaped. Fields typed `float` re-serialize ints as `87.0`, identical once JS parses them.
- Generated TS response objects carry `& {[key: string]: unknown}` (from extra=allow). Honest, slightly loose.

## Test
```
$ cd services/climate && uv run pytest tests/api -q
......................                                                   [100%]
22 passed in 27.31s
$ uv run pytest -q
145 passed in 64.19s (0:01:04)
$ uv run ruff check . && uv run ruff format --check .
All checks passed!
31 files already formatted
$ uv run python -m climate.api.dump_openapi && pnpm -F @ucdt/contracts gen && git status --short packages
wrote .../packages/contracts/openapi.json
🚀 openapi.json → src/schema.ts [41.7ms]
(git status: empty, no diff)
$ (packages/contracts) npx tsc --noEmit --strict --module nodenext --moduleResolution nodenext --allowImportingTsExtensions --skipLibCheck src/index.ts
TSC_OK
$ uv run uvicorn climate.api.main:app --port 8000   # dev DB already held worker snapshots
GET /healthz -> {"status":"ok"} [200]
GET /v1/flood/latest?lat=10.8&lng=106.7 -> {"observedAt":"2026-09-23T18:20:55.517Z","stale":false,"overallRisk":"low","riskScore":0.232,... [200]
GET /v1/history/nope -> {"detail":"unknown hazard 'nope'"} [404]
POST /v1/simulation {"scenario":{"trafficReduction":101}} -> [422] msg "trafficReduction must be 0-100"
POST /v1/simulation {} -> {"simulationId":"sim-1790187677400-1","status":"completed",... [200]
GET /v1/heat/latest -> Internal Server Error [500]   <- T-006 heat shape, see Handoff
```

## Handoff
- **T-006 cross-seam bug:** `snapshots.py` stores `heat.compute_heat(...)`, which is heat.service's raw shape (cityAvgTemp, uhiEffect, hotspots[feelsLike, heatRisk, ...]). Legacy `/api/heat` returned heatController's TRANSFORMED shape (city, avgTemperature, maxTemperature, heatIslandIntensity, hotspots[temperature=effectiveTemperature, intensity=urbanDensity], geojson FeatureCollection): `Hackathon-BE/src/controllers/heat.controller.ts:18-40`. Web `HeatData` matches the transformed shape. Live result: `/v1/heat/latest` → 500 ResponseValidationError (27 errors). The fix belongs in T-006: apply the controller transform, with `city` = settings.city_id. `tests/api/test_api.py heat_controller_shape` is the reference.
- Simulation needs `weather`, `flood` and `aqi` snapshots; it returns 503 until all three exist.
- The DB has no CHECK on `alerts.type` or `alerts.severity`. A row outside {flood,aqi,heat,storm,system} / {info,warning,critical} makes `/v1/alerts` return 500. This is a candidate constraint for a future migration (T-003 area).
- tests/api use their own DB, `ucdt_test_api`. tests/db downgrades `ucdt_test` to base, and that broke a concurrent run once.
- Web type mismatches (not edited): `WeatherForecastItem` lacks `windSpeed`, which legacy sends. `AQIData.dominantPollutant/trend7d/hourlyPattern`, `AQIStation.category` and `SimulationResult.geojson` are optional fields the legacy backend never sends. Nothing required is missing. Legacy `/api/alerts/read` returned `marked: ids.length`; v1 returns the number of rows actually changed.
