---
id: T-006
title: ingest + worker
owner: claude-opus-5 (subagent)
scope: services/climate/climate/{ingest,worker}/**, services/climate/climate/snapshots.py, services/climate/tests/{ingest,worker}/**, services/climate/Dockerfile
exit: `uv run pytest tests/ingest tests/worker` green (fake HTTP + real DB); worker on compose dev writes all 5 hazards to risk_snapshots
phase: review
blocked:
created: 2026-09-23T1617Z
sprint: S-001
issue: 8
pr: 23
---

## Plan
httpx clients for Open-Meteo forecast + air-quality (+ IQAir/AQICN fallbacks when keys are set). Fix B-012: match the current hour in Asia/Ho_Chi_Minh local time, with a test. arq cron every 15 min + once on startup: ingest -> snapshots (weather/aqi/flood/heat/recommend, with inputs + model_version) -> alerts -> publish ucdt:events.

## Execute
- `climate/ingest/weather.py` — `fetch_forecast` (raises on HTTP error), `transform_forecast` = port of legacy `transformOpenMeteoResponse`, `local_time`. **B-012 fix:** the current hour is matched on wall-clock time in the requested zone, computed from Open-Meteo's own `utc_offset_seconds` (the request sends `timezone=settings.city_timezone`). Not `zoneinfo`: Windows has no tz database without the `tzdata` package, which we may not add. Requests `forecast_days=2` (legacy 1): once the index is local, a 1-day window leaves < 24 forecast hours for most of the day.
- `climate/ingest/air.py` — `fetch_aq`: Open-Meteo AQ, then IQAir only if `iqair_api_key`, then AQICN only if `aqicn_token`; None when all fail. Logs the exception TYPE only (httpx error text carries the URL, i.e. the key). AQICN `"aqi":"-"` treated as a failure.
- `climate/snapshots.py` — `store_run(session, forecast_raw, city_aq, station_aqs, now)`: transform, compute_flood/aqi/heat + rules.recommendations, then writes weather_obs ('city'), aqi_obs (city + each station that answered), the 5 snapshots (`model_version="pdim-s1"`), and `rules.new_alerts` deduped against `repo.list_active_alerts` (read_at -> isRead). Caller owns the transaction. Alerts: `rule_id = "A-<TYPE>"`, system alert inserted already read (legacy `isRead: true`), `snapshot_id` = flood/aqi/heat snapshot by type, storm -> weather, system -> recommend.
- `climate/worker/main.py` — `ingest` cron job: fetch all (forecast + city AQ + 23 stations, one `httpx.AsyncClient`, 8 s timeout) -> on any fetch failure log + return "skipped" (nothing written) -> `async with sessionmaker() as s, s.begin(): store_run(...)` -> after commit publish one `snapshot.updated` per hazard and one `alert.created` per new id on `ucdt:events`. `WorkerSettings`: cron minutes `range(0, 60, ingest_interval_minutes)`, `run_at_startup=True`, `keep_result=0`.
- `services/climate/Dockerfile` — two-stage python:3.12-slim + uv 0.11, `uv sync --locked --no-dev`, non-root uid 10001, venv on PATH. Default CMD = api (`uvicorn climate.api.main:app --host 0.0.0.0 --port 8000`).

## Review
- Contract check against BOARD Decision 2026-09-23 (`ucdt:events`): only the two shapes are published; hazards are exactly the web KEY set.
- Snapshot `result` == legacy `data`: proven end-to-end in `test_ingest_writes_legacy_payloads_then_publishes` (fixture scenario flood-plus-smog through respx -> worker -> JSONB -> compared to parity.json outputs within 1e-9).
- Publish-after-commit: the fake Redis opens a NEW connection at each publish and counts snapshots; all events saw 5 rows.

## Test
```
$ cd services/climate && uv run pytest tests/ingest tests/worker -q
21 passed in 6.96s
$ uv run ruff check . && uv run ruff format --check .
All checks passed!
34 files already formatted
$ uv run pytest -q
144 passed in 43.58s
```
B-012 regression proven to bite: with `local_time` monkeypatched back to legacy UTC matching, `-k b012` -> `2 failed`.

Real run (compose dev DB + live Open-Meteo, 2026-09-23T18:20Z = 01:20 HCMC):
```
$ REDIS_URL=redis://127.0.0.1:6379/0 DATABASE_URL=postgresql+asyncpg://ucdt:ucdt@127.0.0.1:5432/ucdt \
  uv run arq climate.worker.main.WorkerSettings --burst
01:20:54: Starting worker for 1 functions: cron:ingest
01:20:55:   0.50s → cron:ingest()
01:20:58: ingest ok: 5 snapshots, 1 new alerts
01:20:58:   2.92s ← cron:ingest ● 'ok'
(second run) 01:21:22: ingest ok: 5 snapshots, 0 new alerts   <- system alert deduped

$ psql -c "select hazard, count(*), max(computed_at) from risk_snapshots group by hazard order by hazard"
  hazard   | count |             max
-----------+-------+------------------------------
 aqi       |     2 | 2026-09-23 18:21:20.99109+00
 flood     |     2 | 2026-09-23 18:21:20.99109+00
 heat      |     2 | 2026-09-23 18:21:20.99109+00
 recommend |     2 | 2026-09-23 18:21:20.99109+00
 weather   |     2 | 2026-09-23 18:21:20.99109+00

weather snapshot: current.timestamp 2026-09-23T18:21:20.991Z, forecast[0].hour 2026-09-24T01:00  <- HCMC local hour (legacy: 00:00 fallback)

$ redis-cli SUBSCRIBE ucdt:events   (during the second run)
{"type": "snapshot.updated", "hazard": "weather"} ... aqi, flood, heat, recommend
```
Docker: `docker build -t ucdt-climate:t006 services/climate` ok; in the image `id -u` = 10001, `import climate.worker.main` ok, `arq 0.28.0`, `alembic 1.20.0`; venv 91 MB, image 298 MB.

## Handoff
- **Worker entry:** `arq climate.worker.main.WorkerSettings` (forever) / `--burst` (one run, exits). Needs `DATABASE_URL`, `REDIS_URL`; migrations must be at head (`alembic upgrade head` works in the same image).
- **For T-010 (compose):** one image, build context `services/climate`. api = default CMD (:8000); worker `command: ["arq", "climate.worker.main.WorkerSettings"]`; migrate `command: ["alembic", "upgrade", "head"]`. No `.dockerignore` (outside my scope): the build only COPYs pyproject/uv.lock/alembic.ini/climate, so `.venv` is not in the image, but it is sent as build context — add `services/climate/.dockerignore` (`.venv`, `tests`, `**/__pycache__`) to speed builds.
- **For T-007:** snapshots as agreed; alert `rule_id` is `A-FLOOD|A-AQI|A-STORM|A-SYSTEM` (legacy alerts had none); `inputs` per hazard: weather `{openMeteo: raw}`, aqi `{city, stations (aligned to AQI_POINTS, null = failed), forecast}`, flood `{rainfall, month}`, heat `{current}`, recommend `{current, rainfall, month, aqi}`. Recompute with `computed_at` as `now`.
- **Outside scope, lead's call:** (1) `climate/config.py` defaults use `localhost`; on Windows redis-py times out on `::1` (arq's 1 s connect timeout) and asyncpg pays ~2 s per connect — the real run needed `127.0.0.1` URLs. Suggest 127.0.0.1 defaults. (2) `climate/pdim/rules.py` system alert says "Dữ liệu làm mới mỗi 5 phút"; the worker refreshes every 15 min (legacy text, parity-locked by parity.json). (3) `tests/db` shares `ucdt_test` with any other worktree running it at the same time — one full run here failed 3 tests in `tests/db/test_db_repo.py` while another agent's suite was likely running; rerun alone and full were green. My worker tests use their own `ucdt_test_worker` DB.
