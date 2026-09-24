---
id: T-104
title: API + contracts + gateway for S-002 payloads
owner: claude-opus-5 (subagent)
scope: services/climate/climate/api/**, services/climate/tests/api/**, packages/contracts/**, apps/gateway/**
exit: `uv run pytest tests/api -q` + `bun test` + tsc green; contracts regenerated, no drift
phase: plan
blocked:
created: 2026-09-24T0330Z
sprint: S-002
issue: 49
---

## Plan
Spec §E–§H payloads; GET /v1/maturity (+ /api/maturity); observedStations in /v1/aqi/latest; simulation counterfactual; remove affectedBuildings/affectedPopulation.

## Execute
## Review
## Test
## Handoff
