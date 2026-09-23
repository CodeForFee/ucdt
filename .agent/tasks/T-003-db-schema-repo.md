---
id: T-003
title: DB schema + repo
owner: claude-opus-5 (subagent)
scope: services/climate/{alembic.ini,climate/db/**}, services/climate/tests/db/**
exit: `uv run alembic upgrade head` seeds 63 spatial_units; `uv run pytest tests/db` green against compose postgres
phase: review
blocked:
created: 2026-09-23T1617Z
sprint: S-001
issue: 4
---

## Plan
SQLAlchemy 2 async + asyncpg, Alembic. Tables: spatial_units(id, kind, name, geom geography(Point,4326), props jsonb), weather_obs, aqi_obs, risk_snapshots(id, hazard, computed_at, model_version, inputs jsonb, result jsonb), alerts(id pk, rule_id, type, severity, title, message, snapshot_id, created_at, expires_at, read_at). repo.py: insert_weather_obs, insert_aqi_obs, insert_snapshot, latest_snapshot(hazard), history(hazard, hours), insert_alerts (ON CONFLICT DO NOTHING), list_alerts(active), mark_alerts_read(ids). Seed from climate/spatial/units.py (read-only import).

## Execute
2026-09-23 claude-opus-5 (subagent), branch `feat/T-003-db-schema-repo`.
- `alembic.ini` (script_location `%(here)s/...`, no URL in the ini) + `climate/db/migrations/env.py` (async; URL = `config.attributes["url"]` or `get_settings().database_url`; hand-written migrations, no autogenerate).
- `versions/001_initial.py`: `CREATE EXTENSION IF NOT EXISTS postgis`, 5 tables exactly as specified (bigserial ids, CHECKs on kind/hazard, FK alerts.snapshot_id ON DELETE SET NULL, the 4 indexes incl. DESC), seeds all 63 units from `ALL_UNITS` via `ST_SetSRID(ST_MakePoint(lng,lat),4326)::geography`, props = extra fields. Downgrade drops the 5 tables but NOT the postgis extension (the postgis image pre-installs it plus dependants in POSTGRES_DB).
- `climate/db/models.py`: SQLAlchemy Core `Table`s + a 4-line `Geography` UserDefinedType (no geoalchemy2).
- `climate/db/session.py`: `get_engine()`, `get_sessionmaker()` (lru_cached, from settings).
- `climate/db/repo.py`: the 9 functions with the agreed names.
## Review
## Test
```
$ uv run alembic upgrade head          # local compose DB
INFO  [alembic.runtime.migration] Running upgrade  -> 001, Initial schema: ...
$ psql -c "select kind, count(*) from spatial_units group by kind order by kind"
 aqi_point  |    23
 flood_zone |    18
 heat_cell  |    22
$ uv run ruff check . && uv run ruff format --check . && uv run pytest tests/db -q
All checks passed!
15 files already formatted
.........                                                                [100%]
9 passed in 35.57s
```
35 s on Windows is `localhost` resolving to ::1 first (compose publishes 127.0.0.1 only), ~2 s per NullPool connect; with `DATABASE_URL=...@127.0.0.1:5432/ucdt` the same run is `9 passed in 1.03s`.
Tests: 63 units vs ALL_UNITS (kind, name, lat/lng, props) + raw ST_Y/ST_X/ST_SRID spot check; kind/hazard CHECKs; weather/aqi inserts; latest_snapshot + history (oldest first, `since` inclusive); insert_alerts conflict-do-nothing (original row kept); FK set-null; active/expired filter (expires_at == now is expired) and ordering; mark_alerts_read (only unread counted); downgrade base -> upgrade head.
## Handoff
Repo contract for T-006 / T-007 (`climate/db/repo.py`):
- Every function takes an `AsyncSession` and returns **plain dicts** (column -> value; tz-aware datetimes; jsonb decoded). **None of them commit** — wrap calls in `async with get_sessionmaker()() as s, s.begin():`.
- `insert_weather_obs(s, location_id, fetched_at, payload) -> int`
- `insert_aqi_obs(s, location_id, fetched_at, *, aqi, pm25, pm10, o3, no2, source) -> int` (all measurement kwargs optional)
- `insert_snapshot(s, hazard, computed_at, model_version, inputs, result) -> int`
- `latest_snapshot(s, hazard) -> dict | None` (full row)
- `history(s, hazard, since) -> list[dict]` — computed_at >= since, **oldest first**
- `insert_alerts(s, rows) -> list[str]` — rows need id, rule_id, type, severity, title, message, created_at, expires_at, optional snapshot_id; returns only newly inserted ids
- `list_active_alerts(s, now) -> list[dict]` — expires_at > now, created_at desc (ties by id); read alerts included
- `mark_alerts_read(s, ids, now) -> int` — only rows still unread are touched/counted
- `list_spatial_units(s, kind=None) -> list[dict]` — {id, kind, name, lat, lng, props}, ordered by kind, id
Tests use db `ucdt_test` on the DATABASE_URL server (created if missing). CI does not run pytest yet — T-002 adds the postgres service + pytest step.
Known ceiling: migration 001 imports `ALL_UNITS` live (`ponytail:` comment) — freeze rows there if units.py ever changes.
