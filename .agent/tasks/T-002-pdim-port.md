---
id: T-002
title: PDIM logic port (Python)
owner: claude-opus-5 (subagent)
scope: services/climate/climate/pdim/{risk,flood,heat,aqi,simulation,rules,geo}.py, services/climate/tests/pdim/**, .github/workflows/climate.yml
exit: `cd services/climate && uv run pytest tests/pdim` green incl. parity <=1e-9 vs tests/fixtures/parity.json; invariants B-004, B-005, B-008, B-011; spatial naming
phase: review
blocked:
created: 2026-09-23T1617Z
sprint: S-001
issue: 3
---

## Plan
Pure functions only (no I/O). Inputs = WeatherResponse-shaped dict + raw AQ values + month + now, exactly as recorded in the fixture. Port riskCalculator.ts, googleFlood.client.ts computeFloodData (month injected), heat.service getHeatData, aqi.service buildNowcast24h/trend/assembly, simulation.service runSimulation math, recommend.service rules, alerts.service rule firing (first-call semantics), geoUtils. Also port pm25ToAQI + normalizeAQI (dataTransformer) into aqi.py since AQI assembly needs them.

## Execute
claude-opus-5 (subagent), branch `feat/T-002-pdim-port`, 2026-09-23.

Seven pure modules under `services/climate/climate/pdim/` — no I/O, no clock reads; `now: datetime` and `month` are parameters. Outputs are dicts with the legacy camelCase keys.
- `risk.py` — riskCalculator.ts (`flood_risk_score`, `flood_risk_level`, `aqi_nowcast_step`, `heat_index`, `effective_temp`, `aqi_level`, `estimated_depth_m`), plus the JS-parity helpers everything else uses: `js_round` (Math.round, ties to +inf), `to_fixed` (toFixed via exact Decimal, ties away from zero), `js_iso` (toISOString), `epoch_ms` (Date.now()), `as_utc`.
- `geo.py` — `generate_flood_polygon`, `create_geojson_feature`, `haversine_distance`.
- `flood.py` — `compute_flood(rainfall, month, soil_saturation=None, drainage_capacity=None)`, plus `flood_areas(...)`, the 18-zone scorer that the baseline and the what-if share (same grid, Algorithm 2 step 7).
- `heat.py` — `compute_heat(weather_current, now)`, `heat_risk_level`.
- `aqi.py` — `pm25_to_aqi`, `normalize_aqi`, `raw_from_open_meteo(current)`, `build_nowcast_24h`, `aqi_trend`, `compute_aqi(city_raw, station_raws, forecast, now)`. `station_raws` lines up with AQI_POINTS (`zip(strict=True)`); a `None` entry is dropped. `city_raw=None` raises ValueError (legacy threw).
- `simulation.py` — `validate_scenario(s)`, `run_simulation(scenario, weather, flood, aqi, now, simulation_id=None)`.
- `rules.py` — `recommendations(weather, flood, aqi, now)`, `new_alerts(weather, flood, aqi, now, active)`, `PRIORITY_OF_SB`.

Where this deviates from the legacy code:
- `validate_scenario` treats `urbanDensity: None` the same as absent (score at the baseline). Legacy rejected JSON `null` because `null !== undefined` and `isFinite(null)` is false. Every other field keeps the legacy behaviour: missing, bool, str, NaN or inf are rejected.
- The rules derive `priority` from S(b) through `PRIORITY_OF_SB` instead of repeating a literal per rule, so B-008 holds by construction. Output is identical.
- `new_alerts` returns only the NEW alerts. The caller owns the queue: it prunes expired alerts, passes the remaining active ones in, appends the result, and sorts by createdAt descending. Ids are `alert-<epoch ms>-<len(active)+k>`, which keeps the legacy shape and is unique within one queue.
- `run_simulation`'s `simulation_id` defaults to `sim-<epoch ms>-1`. The legacy module-level counter is the caller's job now.
- Heat's UHI mean sums left to right in a loop, not with `sum()`. Python 3.12's `sum()` of floats is compensated and can differ from JS `reduce` in the last ulp.
- `Math.max(...[])` can't be reached, because HEAT_CELLS is a non-empty constant, so plain `max()` is used.
- The fallback hour in `build_nowcast_24h` truncates `now` to the hour in UTC. Legacy truncated in HCMC local time, but UTC+7 is a whole-hour offset, so the result is the same.

CI: `.github/workflows/climate.yml` adds a `postgis/postgis:16-3.4-alpine` service (ucdt/ucdt/ucdt, health-checked with pg_isready, port 5432) and job-level `DATABASE_URL=postgresql+asyncpg://ucdt:ucdt@localhost:5432/ucdt`, and runs `uv run pytest -q` after ruff. The job name is still `climate` and there is no path filter.

## Review
## Test
```
$ cd services/climate && uv run ruff check . && uv run ruff format --check . && uv run pytest tests/pdim -q
All checks passed!
16 files already formatted
........................................................................ [ 63%]
..........................................                               [100%]
114 passed in 0.23s
```
- `tests/pdim/test_pdim_parity.py` compares every `pure` group (10 functions plus validateScenario; a test asserts no group is left uncovered) and all 11 scenarios × {flood, heat, aqi, recommend, alertsFirstCall, 5 simulations}. It recurses through every key: numbers must be within 1e-9 abs, strings/bools/None must match exactly including type, and alert ids and simulationId are checked by regex. `test_js_helpers` pins the tie cases, e.g. `to_fixed(0.125, 2) == "0.13"` and `js_round(-2.5) == -2`. Sensitivity was checked by hand: the comparator fails on a changed number, string, key set, list length, or bool/int or None/0 type mismatch.
- `tests/pdim/test_pdim_legacy.py` ports riskCalculator, scenarioValidation (plus inf, str, bool and missing-key cases) and spatialNaming. It adds an API-surface check: the names in the flood/heat/aqi payloads contain no administrative-unit label.
- `tests/pdim/test_pdim_invariants.py` covers:
  - B-004: tempDelta is below 0 at density 0.3, above 0 at 0.95, and 0 when density is omitted, None or at baseline.
  - A 96-case recommendation grid that fires all 9 rules plus R-NORM-00. Over that grid: B-005 (ruleId, priorityScore, inputs and actionItems on every item) and B-008 (priority == map[S(b)], π = round(S·E·F, 2) > 0, sorted descending; R-NORM-00 is alone, has π 0 and level low).
  - B-011: all 4 trigger keys are present and w1·P̃+w2·T̃+w3·Ĩ−w4·D̃ reproduces riskScore within 1e-3 (both values are served at 3 dp).
  - Alert dedupe and re-fire after being marked read, with unique ids.
  - A failed AQI station fetch is dropped.

## Handoff
- Wave 2 (T-006 ingest, T-007 climate-api): build the inputs the way the parity test's `_inputs()` does:
  - `raw_from_open_meteo(current)` for the city and for each AQI_POINT, with `None` when a fetch failed;
  - `compute_flood(weather.current.rainfall, hcmc_local_month)`;
  - `compute_aqi(city_raw, station_raws, weather.forecast, now)`.
  After that, pass the payloads to `compute_heat`, `recommendations`, `run_simulation` and `new_alerts`.
- `weather` is the legacy WeatherResponse shape (`current.{temperature,humidity,rainfall,...}`, `forecast[].{hour,windSpeed,rainfall,...}`). The compute layer takes it as given, so the B-012 fix belongs in the ingest transform (T-006).
- The alerts queue (persisting it, pruning expired alerts, marking alerts read) belongs to T-007. `new_alerts` only decides what fires.
- `validate_scenario` is the trust-boundary check. T-007 must call it before `run_simulation`, which does not re-validate.
- `aqi` messages interpolate `aqi["aqi"]` with `{}`. Keep it an `int`, as `compute_aqi` returns it; a float would print "155.0" where legacy printed "155".
