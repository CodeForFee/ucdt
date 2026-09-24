---
id: T-101
title: static layers (DEM, WorldCover, OSM) + toponym renames
owner: claude-opus-5 (subagent)
scope: services/climate/climate/spatial/**, services/climate/climate/db/migrations/versions/002_*.py, services/climate/tests/spatial/**
exit: `uv run --group derive python -m climate.spatial.derive` regenerates derived.json byte-identically from cached responses; `uv run pytest tests/spatial tests/db -q` green; no display name matches the §A.1 guard
phase: plan
blocked:
created: 2026-09-24T0330Z
sprint: S-002
issue: 46
---

## Plan
Spec §A.1–§A.4. Rename 11 heat cells; derive.py (Open-Meteo Elevation stencil, WorldCover 2 km windows via rasterio, OSM commune + road density via Overpass with UA + retry); derived.json with per-unit values, bounds, mapping tables, provenance (source URL, version/licence, retrieval date, method params); catalogue.py loader (typed access, no network); migration 002 updates names + props; guard test over units + derived.

## Execute
## Review
## Test
## Handoff
