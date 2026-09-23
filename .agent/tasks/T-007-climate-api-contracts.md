---
id: T-007
title: climate-api + contracts
owner: claude-opus-5 (subagent)
scope: services/climate/climate/api/**, services/climate/tests/api/**, packages/contracts/**
exit: `uv run pytest tests/api` green; `pnpm -F @contracts gen` produces types with no diff
phase: plan
blocked:
created: 2026-09-23T1617Z
sprint: S-001
issue: 9
---

## Plan
FastAPI internal API: GET /v1/{weather,aqi,flood,heat,recommend}/latest (+observedAt, stale > 45 min), GET /v1/alerts, POST /v1/alerts/read, POST /v1/simulation (pydantic bounds = legacy validateScenario), GET /v1/history/{hazard}?hours=, GET /healthz. Response models match legacy shapes. dump_openapi -> packages/contracts/openapi.json -> openapi-typescript.

## Execute
## Review
## Test
## Handoff
