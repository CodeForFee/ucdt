---
id: T-003
title: DB schema + repo
owner: claude-opus-5 (subagent)
scope: services/climate/{alembic.ini,climate/db/**}, services/climate/tests/db/**
exit: `uv run alembic upgrade head` seeds 63 spatial_units; `uv run pytest tests/db` green against compose postgres
phase: plan
blocked:
created: 2026-09-23T1617Z
sprint: S-001
issue: 4
---

## Plan
SQLAlchemy 2 async + asyncpg, Alembic. Tables: spatial_units(id, kind, name, geom geography(Point,4326), props jsonb), weather_obs, aqi_obs, risk_snapshots(id, hazard, computed_at, model_version, inputs jsonb, result jsonb), alerts(id pk, rule_id, type, severity, title, message, snapshot_id, created_at, expires_at, read_at). repo.py: insert_weather_obs, insert_aqi_obs, insert_snapshot, latest_snapshot(hazard), history(hazard, hours), insert_alerts (ON CONFLICT DO NOTHING), list_alerts(active), mark_alerts_read(ids). Seed from climate/spatial/units.py (read-only import).

## Execute
## Review
## Test
## Handoff
