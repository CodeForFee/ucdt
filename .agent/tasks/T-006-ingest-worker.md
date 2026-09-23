---
id: T-006
title: ingest + worker
owner: claude-opus-5 (subagent)
scope: services/climate/climate/{ingest,worker}/**, services/climate/climate/snapshots.py, services/climate/tests/{ingest,worker}/**, services/climate/Dockerfile
exit: `uv run pytest tests/ingest tests/worker` green (fake HTTP + real DB); worker on compose dev writes 4 hazards to risk_snapshots
phase: plan
blocked:
created: 2026-09-23T1617Z
sprint: S-001
issue: 8
---

## Plan
httpx clients for Open-Meteo forecast + air-quality (+ IQAir/AQICN fallbacks when keys are set). Fix B-012: match the current hour in Asia/Ho_Chi_Minh local time, with a test. arq cron every 15 min + once on startup: ingest -> snapshots (flood/heat/aqi/recommend, with inputs + model_version) -> alerts -> publish ucdt:events.

## Execute
## Review
## Test
## Handoff
