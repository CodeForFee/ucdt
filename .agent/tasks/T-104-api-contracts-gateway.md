---
id: T-104
title: API + contracts + gateway for S-002 payloads
owner: claude-opus-5 (subagent)
scope: services/climate/climate/api/**, services/climate/tests/api/**, packages/contracts/**, apps/gateway/**
exit: `uv run pytest tests/api -q` + `bun test` + tsc green; contracts regenerated, no drift
phase: done
blocked:
created: 2026-09-24T0330Z
sprint: S-002
issue: 49
---

## Plan
Spec §E–§H payloads; GET /v1/maturity (+ /api/maturity); observedStations in /v1/aqi/latest; simulation counterfactual; remove affectedBuildings/affectedPopulation.

## Execute
- `climate/api/models.py` — typed every T-103 payload change: `FloodTerm` (decomposition, city +
  per area), `FloodTriggers` 4 terms (soilSaturation gone), `FloodArea.rainfall`, `HeatBaselines`,
  `avgEffectiveTemperature` now required, `ObservedStation`, `Recommendation` per-unit item +
  typed `RecommendationInputs`, `RecommendData.firedCount`, `Alert` type/severity without
  system/info, simulation `SimStation` / `Counterfactual` / `SimAlert` / `BandChanges`,
  maturity models (`MaturityResponse` … `GammaEstimate`). `Latest` gains `modelVersion`
  (snapshot model_version; `pdim-s2-aqi` shows when the nowcast runs on fitted γ).
- `climate/api/main.py` — latest routes validate the body against the model; a failure (old
  shape) → 503 `no snapshot yet in the current shape`. `response_model_exclude_unset` so optional
  typed fields absent in the stored result stay absent (served == stored). `/v1/alerts` drops
  rows of pre-S-002 types (system/info) instead of 500-ing, sorts newest → critical first.
  `/v1/simulation` = `run_counterfactual` on the latest flood/heat/aqi snapshots; `KeyError`
  (pre-S-002 inputs/baselines) → 503. `GET /v1/maturity` = `snapshots.evaluate_maturity`.
- `apps/gateway/src/app.ts` — `/api/maturity` → `/v1/maturity`, cached 600 s; alerts uncached,
  envelope/error mapping and `/api/history/:hazard` unchanged.
- `packages/contracts` regenerated.
- `tests/api/test_api.py` — seeds through `snapshots.store_run` (the worker's own writer), old
  shape only for the 503 cases; §A.1 guard over every payload (latest ×5, alerts, maturity, two
  simulations; `commune` checked by its own rule).

## Review
- The "no snapshot in the current shape" 503 on latest is decided by the response model, so a
  future required field added without a model change would not trip it; a model change that
  adds a required field makes every older snapshot a 503 until the next run (≤ 15 min).
- `KeyError` → 503 on the simulation could also mask a real KeyError bug in
  `run_counterfactual`; it is logged (`what-if baseline is not in the current shape`).
- Served alerts carry no `unitId`: the unit is in the id (`<hazard>:<unitId>:…`) and named in
  the message. Add a field if T-105 needs to link an alert to a map unit.

## Test
```
$ cd services/climate && uv run pytest -q
275 passed in 6.00s
$ uv run ruff check . && uv run ruff format --check .
All checks passed!
52 files already formatted
$ cd apps/gateway && bun test && bunx tsc --noEmit
 29 pass  0 fail  72 expect() calls
(tsc: no output, exit 0)
$ uv run python -m climate.api.dump_openapi && pnpm -F @ucdt/contracts gen && git diff --exit-code packages/contracts
(no diff)
```
Live (worker `--burst` on Redis db 1 → uvicorn :8010 → gateway :3010, all started and stopped here):
```
GET /api/weather -> 200 MISS temp 27.2 rain 1.9 model pdim-s1 stale False
GET /api/aqi -> 200 MISS aqi 39 stations 23 observedStations [('ag:82509', 19, 'station-q10')] model pdim-s1
GET /api/flood -> 200 MISS R_f 0.288 medium triggers {currentRainfall 1.9, terrainSensitivity 0.59, imperviousness 0.623, drainageCapacity 0.413} areas 18
   decomposition rainfall 0.45×0.038=0.0171, terrain 0.3×0.59=0.1771, imperviousness 0.25×0.623=0.1557, drainage 0.15×0.413=−0.062
GET /api/heat -> 200 MISS avgT 27.2 avgTeff 32 max 35.1 baselines {density 0.708, greenPct 21.8}
GET /api/recommend -> 200 MISS firedCount 17 level medium top R-FLOOD-03:gz-q6-binh-tien Bình Tiên π 1.52 (commune Phường Phú Lâm) …
GET /api/alerts -> 200 (uncached) total 0
GET /api/maturity -> 200 MISS; second call HIT
   flood S1 (inundationSeries 0/1) · heat S1 (lstSeries 0/1) · aqi S1 (consecutiveHourPairs 1/168, spanDays 0.04/7, s1Mae 9.85)
GET /api/history/flood?hours=1 -> 200 entries 5
POST /api/simulation {rain +200 %, green +10, traffic −30} -> 200 ΔR_f 0.03 ΔT −1.5 ΔAQI −10.8
   stations[0] Bến Nghé 39 → 19; results keys aqiDelta, floodRiskDelta, newFloodAreas, stations, tempDelta
   counterfactual firedCount 17, top R-FLOOD-02:gz-q6-binh-tien π 2.42; alerts flood:gz-q6-hau-giang:warning:2026-09-24T13 …
   bandChanges flood 2 (Hậu Giang medium → high), heat 0, aqi 0
POST /api/simulation {rainfallIncrease 9999} -> 400 "rainfallIncrease must be 0-500"
```

## Handoff
**For T-105 (web).** All routes go through the gateway envelope `{success, data, timestamp,
cached}`; any climate 503 (no snapshot, or only an old-shape one) arrives as **502** — show "đang
chờ dữ liệu" and retry, do not crash. `@ucdt/contracts` (`components["schemas"][...]`) covers
every shape below; names in brackets.
- `/api/flood` [`FloodLatest`]: `triggers {currentRainfall, terrainSensitivity, imperviousness,
  drainageCapacity}`; `decomposition: FloodTerm[]` = `{key: rainfall|terrain|imperviousness|drainage,
  weight (>0), normalized, contribution (drainage < 0)}` at city level AND on every
  `affectedAreas[i]` (+ `rainfall` mm/h). Render terms from these — no weights in the web (B-014);
  delete `features/flood/lib/decomposeFloodRisk.ts`.
- `/api/heat` [`HeatLatest`]: `baselines {density ρ₀ 0–1, greenPct G₀ %}` — slider start values;
  `avgEffectiveTemperature` always present now.
- `/api/aqi` [`AQILatest`]: `observedStations: ObservedStation[]` `{id "ag:<n>", name, lat, lng,
  aqi, pm25, observedAt, source, nearestPointId}` → map markers "trạm quan trắc".
- every latest payload: `modelVersion` (`pdim-s1` | `pdim-s2-aqi`), `observedAt`, `stale`.
- `/api/recommend` [`RecommendLatest`]: `firedCount`; `recommendations: Recommendation[]` (top 10)
  `{id "<ruleId>:<unitId>", ruleId, unitId, unitName, unitKind flood_zone|heat_cell|aqi_point|city,
  commune (NEVER render, §A.3), priorityScore π, priority, category, title, message, actionItems,
  timestamp, inputs: RecommendationInputs {severityBand, exposureE?, feasibilityFa?, riskScore?,
  rainfall?, aqi?, aqiPointId?, effectiveTemperature?}}`. R-NORM-00: `unitKind "city"`, π 0.
- `/api/alerts` [`AlertsResponse`]: `type flood|storm|aqi|heat`, `severity warning|critical`, id
  `<hazard>:<unitId>:<band>:<YYYY-MM-DDTHH>`; newest first, critical first within a run. No system
  alert any more.
- `POST /api/simulation` [`SimulationResult`]: `results {floodRiskDelta, newFloodAreas (FloodArea
  incl. rainfall/decomposition), tempDelta, aqiDelta, stations: SimStation[] {id, name, before,
  after, delta}}` (affectedBuildings/affectedPopulation gone), `comparison` unchanged,
  `counterfactual: {recommendations: Recommendation[], firedCount, alerts: SimAlert[] {id, type,
  severity, unitId, unitName, title, message, createdAt, expiresAt}, bandChanges {flood, heat, aqi:
  BandChange[] {unitId, name, before, after}}}` → "Khuyến nghị cho kịch bản" panel.
- `/api/maturity` [`MaturityResponse`]: `{evaluatedAt, windowDays 14, deltaAqi 2, hazards:
  HazardMaturity[] {hazard, active S1|S2|S3, modelVersion, stages {S1, S2, S3: {eligible, reason?,
  criteria [{name, current, required}]}}, s1MaeHoldout|null, s2: null | {estimates {gammaWind,
  gammaRain: {value, estimate, se, ci95 [lo, hi]}}, maeHoldout, nTrain, nHoldout, promoted}}}`.
  Cached 600 s in the gateway.

**For the lead.**
- `run_simulation` + `_legacy_flood_areas` in `climate/pdim/simulation.py` are now dead (the
  route calls `run_counterfactual`); `tests/pdim/test_pdim_parity.py` still exercises
  `run_simulation` (drop that parity case with it). PDIM_S1 `terrainDefault` / `densityBaseline`
  are still referenced by `pdim/risk.py`, so check before deleting them. Outside my scope.
- The compose `ucdt-climate-worker-1` (old image, db 0) keeps writing OLD-shape snapshots every
  15 min; after it writes, `/api/{aqi,flood,heat,recommend}` and `/api/simulation` return 502
  until a new-shape run is newer. Rebuild/restart the compose worker + API images after merge.
- Spec §A.3 says the unit → commune table "is served by the API"; it is served only per item in
  recommendations (§E). If a full mapping is meant, add it to the spec (e.g. `/v1/units`).
