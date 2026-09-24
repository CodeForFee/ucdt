---
id: T-103
title: processing: per-unit PDIM, π(r,i), per-unit alerts, counterfactual, Algorithm 1
owner: claude-opus-5 (subagent)
scope: services/climate/climate/pdim/**, services/climate/climate/snapshots.py, services/climate/climate/worker/**, services/climate/climate/db/repo.py, services/climate/tests/{pdim,worker,db}/**
exit: `uv run pytest -q` green; formula parity with legacy kept for the pure functions; worker --burst on compose writes the five snapshots per spec
phase: plan
blocked:
created: 2026-09-24T0330Z
sprint: S-002
issue: 48
---

## Plan
Spec §B–§H. Catalogue-injected compute functions (legacy catalogue in parity tests); per-unit rules + E(i); alert band-change evaluation vs previous snapshot; simulation counterfactual; maturity.py (Algorithm 1).

## Execute
## Review
## Test
## Handoff
