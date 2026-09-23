---
id: T-002
title: PDIM logic port (Python)
owner: claude-opus-5 (subagent)
scope: services/climate/climate/pdim/{risk,flood,heat,aqi,simulation,rules,geo}.py, services/climate/tests/pdim/**, .github/workflows/climate.yml
exit: `cd services/climate && uv run pytest tests/pdim` green incl. parity <=1e-9 vs tests/fixtures/parity.json; invariants B-004, B-005, B-008, B-011; spatial naming
phase: plan
blocked:
created: 2026-09-23T1617Z
sprint: S-001
issue: 3
---

## Plan
Pure functions only (no I/O). Inputs = WeatherResponse-shaped dict + raw AQ values + month + now, exactly as recorded in the fixture. Port riskCalculator.ts, googleFlood.client.ts computeFloodData (month injected), heat.service getHeatData, aqi.service buildNowcast24h/trend/assembly, simulation.service runSimulation math, recommend.service rules, alerts.service rule firing (first-call semantics), geoUtils. Also port pm25ToAQI + normalizeAQI (dataTransformer) into aqi.py since AQI assembly needs them.

## Execute
## Review
## Test
## Handoff
