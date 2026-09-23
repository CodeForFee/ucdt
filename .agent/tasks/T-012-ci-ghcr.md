---
id: T-012
title: CI complete + GHCR
owner: claude-sonnet-5 (subagent)
scope: .github/workflows/**
exit: CI green on its own PR; the contracts drift check fails on a deliberate drift
phase: plan
blocked:
created: 2026-09-23T1617Z
sprint: S-001
issue: 13
---

## Plan
ruff/pytest (with a postgres service), bun test/tsc, web lint/test/build, contracts `git diff --exit-code`, build + push images to ghcr.io on main.

## Execute
## Review
## Test
## Handoff
