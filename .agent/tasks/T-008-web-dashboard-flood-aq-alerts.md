---
id: T-008
title: web: dashboard, flood, air-quality, alerts
owner: claude-sonnet-5 (subagent)
scope: apps/web/src/features/{dashboard,flood,air-quality,alerts}/**
exit: `pnpm -F web build lint test` green; manual run against legacy Hackathon-BE shows every card/page
phase: plan
blocked:
created: 2026-09-23T1617Z
sprint: S-001
issue: 10
---

## Plan
Port from Hackathon-FE/src/features/*. B-007: 24 h delta only when /api/history has data; B-009 provenance label; B-010 subtractive term; RiskDecomposition shows all 4 R_f terms.

## Execute
## Review
## Test
## Handoff
