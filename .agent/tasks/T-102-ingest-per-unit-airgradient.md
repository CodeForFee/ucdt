---
id: T-102
title: ingestion: per-unit weather + AirGradient open network
owner: claude-opus-5 (subagent)
scope: services/climate/climate/ingest/**, services/climate/tests/ingest/**
exit: `uv run pytest tests/ingest -q` green with fake HTTP; one live smoke call recorded in the task file
phase: plan
blocked:
created: 2026-09-24T0330Z
sprint: S-002
issue: 47
---

## Plan
Spec §I. fetch_forecast_multi(coords) (one Open-Meteo request, current + hourly, per-location hour alignment reusing local_time/transform_forecast); AirGradient client (bbox filter, pm02 → raw AQ dict, observedAt, location id/name); keep IQAir/AQICN fallbacks.

## Execute
## Review
## Test
## Handoff
