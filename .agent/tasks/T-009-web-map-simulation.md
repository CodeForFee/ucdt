---
id: T-009
title: web: map + simulation
owner: claude-sonnet-5 (subagent)
scope: apps/web/src/features/{map,simulation}/**
exit: `pnpm -F web build lint test` green; manual run against legacy Hackathon-BE: map layers + 3 simulation pages
phase: plan
blocked:
created: 2026-09-23T1617Z
sprint: S-001
issue: 11
---

## Plan
Port from Hackathon-FE. No pdim.ts: previews call POST /api/simulation (debounce 150 ms); the result lives in mutation state, not zustand; B-006 SimHeatLayer shows the backend delta only.

## Execute
## Review
## Test
## Handoff
