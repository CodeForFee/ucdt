---
id: T-103
title: processing: per-unit PDIM, π(r,i), per-unit alerts, counterfactual, Algorithm 1
owner: claude-opus-5 (subagent)
scope: services/climate/climate/pdim/**, services/climate/climate/snapshots.py, services/climate/climate/worker/**, services/climate/climate/db/repo.py, services/climate/tests/{pdim,worker,db}/**
exit: `uv run pytest -q` green; formula parity with legacy kept for the pure functions; worker --burst on compose writes the five snapshots per spec
phase: done
blocked:
created: 2026-09-24T0330Z
sprint: S-002
issue: 48
---

## Plan
Spec §B–§H. Catalogue-injected compute functions (legacy catalogue in parity tests); per-unit rules + E(i); alert band-change evaluation vs previous snapshot; simulation counterfactual; maturity.py (Algorithm 1).

## Execute
- `pdim/flood.py` — `compute_flood(rain_by_zone, city_rainfall, cat, add_green, simulated)`: per-zone
  P̃(i), T̃(i) = ½(1−min(z/10,1)) + ½(1−min(s/2,1)), Ĩ = builtUp, D̃ = localDrain; `decompose()` →
  `[{key, weight, normalized, contribution}]`, R_f = clamp(Σ contribution) (same left-to-right sum
  as `risk.flood_risk_score`, so parity is exact). City: P̃ of the centre, T̃/Ĩ/D̃ = zone means.
- `pdim/heat.py` — `compute_heat(weather_by_cell, city_current, now, cat, city)` returns the served
  (heatController) shape directly, ρ(i) = builtUp, + `baselines {density ρ₀, greenPct G₀}`.
- `pdim/aqi.py` — `compute_aqi(..., observed, gammas, cat)`; `observed_stations(readings, cat)`
  (PM2.5 → AQI, nearest AQI point by `spatial.derive.nearest`, the §A.4 rule);
  `build_nowcast_24h(..., gammas)`.
- `pdim/rules.py` — `unit_values(flood, aqi, heat)` (per-unit values of SERVED payloads, used for
  now / previous / counterfactual alike); `recommendations(values, cat, now, k=10)` (§E, per unit,
  E = clamp(builtUp, 0.1, 1), ranking π desc → ruleId → unit name, firedCount, R-NORM-00);
  `band_alerts(values, previous, cat, now)` (§F).
- `pdim/simulation.py` — `run_counterfactual(scenario, {flood, heat, aqi: snapshot rows}, now, cat,
  simulation_id)` (§G). Legacy `run_simulation` kept verbatim (with a private copy of the legacy
  zone scorer) because `/v1/simulation` still calls it — T-104 deletes it.
- `pdim/maturity.py` (new) — Algorithm 1: validation series V, OLS without intercept (closed-form
  2×2), 95 % CI with a Cornish–Fisher t-quantile (no scipy/numpy), holdout MAE, stateless
  promote/demote, `nowcast_gammas()`.
- `db/repo.py` — `snapshot_inputs`, `oldest_snapshot_at`, `station_readings` (DISTINCT, per source).
- `snapshots.py` — `store_run(session, weather_by_unit, city_aq, station_aqs, readings, now)`;
  `evaluate_maturity(session, now)` (what `/v1/maturity` should serve). aqi snapshots carry
  model_version `pdim-s2-aqi` while S2 is active.
- `worker/main.py` — `fetch_all` = per-unit weather (one request) + AirGradient + CAMS centre/points.

## Review
Self-review against spec §B–§I line by line. Interpretations (not spec edits — flag to the lead):
- §H: V pools every open-network station (each paired with its own mapped point), ordered by
  hour, then station; the 70/30 split is on that order. The 95 % CI is around the UNCLAMPED
  estimate; `value` is the clamped one.
- §H: aqi_obs `fetched_at` of an `ag:` row is the OBSERVATION time (so V bins it into the hour it
  was measured); re-fetched readings are de-duplicated on read.
- §F/§E read the served (rounded) per-unit values for now, previous and counterfactual, so a
  value on a threshold cannot flap between runs through rounding.
- §G: the per-point what-if uses the S1 γ_p even while S2 is active (the spec says only the
  served 24 h nowcast switches).
- R-AQI-03 (AQI > 100): title/severityBand were "trung bình"/"moderate" in legacy; EPA 101–150 is
  "unhealthy for sensitive groups" → now "AQI không tốt cho nhóm nhạy cảm"/"unhealthy_sensitive".

## Test
```
$ uv run pytest -q
266 passed in 5.28s
$ uv run ruff check . && uv run ruff format --check .
All checks passed!
52 files already formatted
```
Parity kept (tests/pdim/test_pdim_parity.py, 1e-9): pure grids; heat and AQI payloads with the
legacy catalogue; legacy `run_simulation`; the counterfactual's city ΔAQI and (untouched density)
ΔT. Changed formulas are tested against hand-computed values (tests/pdim/test_pdim_invariants.py:
zone R_f 0.4634195, π 3.61/3.42/2.58, alert ids + expiries, dry-day shower, ṽ(i), ρ₀) and
Algorithm 1 on synthetic series with known γ (tests/pdim/test_maturity.py).

Real run against the dev DB — `REDIS_URL=redis://127.0.0.1:6379/1 uv run arq
climate.worker.main.WorkerSettings --burst` (db 1: on db 0 the running compose climate-worker, old
image, consumes the job — see Handoff):
```
12:49:50:   0.52s → cron:ingest()
12:50:25: ingest ok: 5 snapshots, 0 new alerts
flood   pdim-s1 ['affectedAreas', 'decomposition', 'overallRisk', 'riskScore', 'triggers']
heat    pdim-s1 [... 'baselines' ...]   aqi pdim-s1 [... 'observedStations' ...]
recommend pdim-s1 ['firedCount', 'overallRiskLevel', 'recommendations', 'summary']
zone gz-q6-binh-tien Bình Tiên riskScore 0.411 rainfall 6.0
   rainfall        0.45 × 0.12     = 0.054
   terrain         0.30 × 0.60     = 0.18
   imperviousness  0.25 × 0.949642 = 0.2374105
   drainage        0.15 × 0.40     = −0.06
   sum 0.4114105  → 0.411
city 0.316 {'currentRainfall': 5.0, 'terrainSensitivity': 0.59, 'imperviousness': 0.623, 'drainageCapacity': 0.413}
firedCount 17 medium
   R-FLOOD-03:gz-q6-binh-tien  Bình Tiên      π 1.52 (E 0.949642, F 0.8, R_f 0.411)
   R-FLOOD-03:gz-q6-hau-giang  Hậu Giang      π 1.51 (E 0.941667, F 0.8, R_f 0.382)
   R-FLOOD-03:gz-q11-lac-long  Lạc Long Quân  π 1.49 (E 0.928556, F 0.8, R_f 0.326)
observedStations [{'id': 'ag:82509', 'name': 'CMT8', 'aqi': 30, 'pm25': 7.2, 'nearestPointId': 'station-q10', ...}]
maturity aqi: active S1, S2 not eligible (consecutiveHourPairs 0/168, spanDays 0/7), S3 archiveMonths 0/12,
  s1MaeHoldout null, s2 null
```

## Handoff
**Payload changes T-104 must mirror** (api/models.py, contracts, gateway, and the web in T-105):
- flood: `triggers` = {currentRainfall, terrainSensitivity (city mean T̃, 3 dp), imperviousness
  (city mean Ĩ, 3 dp), drainageCapacity (city mean D̃, 3 dp)} — `soilSaturation` REMOVED (the
  current `FloodTriggers` model requires it → /v1/flood/latest 500s on new snapshots).
  New top-level `decomposition: [{key: rainfall|terrain|imperviousness|drainage, weight (>0),
  normalized, contribution (drainage < 0)}]` (full precision; Σ contribution = R_f before clamp).
  `affectedAreas[]` + `rainfall` (P(i), mm/h) + `decomposition` (same shape).
- heat: + `baselines {density: ρ₀ 0–1 (3 dp), greenPct: G₀ % (1 dp)}`; hotspot `intensity` is now
  builtUp(i); every cell from its own weather.
- aqi: + `observedStations [{id "ag:<id>", name, lat, lng, aqi, pm25, observedAt, source, nearestPointId}]`;
  `forecast24h` uses the fitted γ while S2 is active (snapshot model_version `pdim-s2-aqi`).
- recommend: + `firedCount`; `recommendations` = top 10; item + `unitId`, `unitName`, `unitKind`
  (flood_zone | heat_cell | aqi_point | city), `commune` (str | null); `id` = `<ruleId>:<unitId>`;
  `inputs`: flood {riskScore, rainfall}, R-COMB-01 {riskScore, aqi, aqiPointId}, AQI {aqi}, heat
  {effectiveTemperature}, + severityBand, exposureE, feasibilityFa; R-NORM-00 id
  `R-NORM-00:city`, inputs {severityBand: "none"}.
- alerts (DB rows): id `<hazard>:<unitId>:<warning|critical>:<YYYY-MM-DDTHH local>`, type
  flood | storm | aqi | heat (no `system`), rule_id `A-<TYPE>`. Serve critical > warning (§F).
- simulation: switch `/v1/simulation` to `simulation.run_counterfactual(scenario,
  {h: await repo.latest_snapshot(s, h) for h in ("flood", "heat", "aqi")}, now, simulation_id=...)`
  and delete `run_simulation` / `_legacy_flood_areas` (+ PDIM_S1 `terrainDefault`,
  `densityBaseline` if nothing else uses them). Response: `results` {floodRiskDelta,
  newFloodAreas (flood areas incl. rainfall/decomposition, geojson.properties.simulated),
  tempDelta, aqiDelta, stations [{id, name, before, after, delta}] (ints)}; `comparison`
  unchanged; top-level `counterfactual` {recommendations (§E items), firedCount, alerts [{id,
  type, severity, unitId, unitName, title, message, createdAt, expiresAt}], bandChanges {flood,
  heat, aqi: [{unitId, name, before, after}]}}. `affectedBuildings`/`affectedPopulation` gone.
  Needs S-002 snapshots (flood `inputs.rainfall/cityRainfall`, heat `result.baselines`, aqi
  `inputs.pointWeather`): a pre-S-002 snapshot raises KeyError — map it to 503.
- maturity: `await snapshots.evaluate_maturity(session, now)` → {evaluatedAt, windowDays,
  deltaAqi, hazards: [{hazard, active, modelVersion, stages {S1, S2, S3: {eligible, reason?,
  criteria [{name, current, required}]}}, s1MaeHoldout, s2: null | {estimates {gammaWind,
  gammaRain: {value, estimate, se, ci95 [lo, hi]}}, maeHoldout, nTrain, nHoldout, promoted}}]}.
- weather_obs("city") payload is now the transformed WeatherResponse (was the raw forecast).

**Ops:** the compose `ucdt-climate-worker-1` runs the OLD image and listens on Redis db 0, so a
local `arq --burst` on db 0 only enqueues — the old worker runs it. Until the image is rebuilt it
also keeps writing old-shape snapshots every 15 min, interleaved with new ones. The dev DB is at
alembic 001 (T-101's 002 not applied; T-103 does not need it).
