---
id: T-001
title: scaffold + interfaces
owner: claude-opus-5
scope: {package.json,pnpm-workspace.yaml,pnpm-lock.yaml,.gitignore,.editorconfig,README.md}, .github/**, infra/{compose.yml,compose.dev.yml,.env.example}, apps/{web,gateway}/package.json, services/climate/{pyproject.toml,uv.lock,.python-version,climate/__init__.py,climate/config.py,climate/pdim/__init__.py,climate/pdim/constants.py,climate/spatial/**}, tools/**, services/climate/tests/fixtures/**
exit: `pnpm install && uv sync` OK; `docker compose -f infra/compose.yml up -d` -> postgres+redis healthy; `tools/gen-parity.ts` writes parity.json; github.com/CodeForFee/ucdt main pushed
phase: done
blocked:
created: 2026-09-23T1617Z
sprint: S-001
issue: 2
---

## Plan
Interface-first wave 0. Declare every dependency for web/gateway/climate so wave-1 seams never touch a lockfile. Port PDIM constants + 63 spatial units verbatim. Generate parity fixture from legacy TS services with fetch mocked + Date frozen (TZ=Asia/Ho_Chi_Minh). Compose with postgis + redis. PR template, CODEOWNERS, per-service CI skeletons. Create private repo + protect main.

## Execute
- Commit `9c96276` on `main` (the only direct commit; everything after goes through PRs).
- Scope grew by two files, both lead-owned interfaces: `.gitattributes` (LF everywhere — CI is Linux, ruff format checks bytes) and `packages/contracts/package.json` (declares openapi-typescript up front so T-007 never touches the lockfile; T-007 owns everything else under packages/contracts).
- pnpm 11 wrote `allowBuilds: esbuild: <placeholder>` into pnpm-workspace.yaml; set to `true`, removed the deprecated `onlyBuiltDependencies`.
- Fixture: 695 pure cases + 11 scenarios. Scenarios cover all 10 recommendation rules (R-FLOOD-01..03, R-AQI-01..03, R-HEAT-01..02, R-COMB-01, R-NORM-00) and all 7 alert type/severity branches. Each scenario runs in a fresh child process (legacy alertQueue is module state) with Date frozen and TZ=Asia/Ho_Chi_Minh.
- GitHub: `CodeForFee/ucdt` private; squash-only, delete-branch-on-merge. **Branch protection refused (HTTP 403: needs GitHub Pro for private repos)** — "main only via reviewed PRs" is a convention, enforced by the lead, not by GitHub.

## Review
Self-review: constants.py diffed by eye against Hackathon-BE/src/utils/constants.ts; units counted (18/22/23 = 63).

## Test
```
$ pnpm install                      → Done (650 packages)
$ cd services/climate && uv sync    → 43 packages; ALL_UNITS = 18 22 23 63
$ uv run ruff check . && uv run ruff format --check . && uv lock --check → All checks passed / 6 files already formatted
$ pnpm parity                       → 695 pure cases, 11 scenarios → services/climate/tests/fixtures/parity.json
$ docker compose -f infra/compose.yml -f infra/compose.dev.yml up -d --wait → postgres Healthy, redis Healthy; postgis_version() = 3.4
$ gh run list --branch main         → climate success, gateway success, web success
```

## Handoff
Wave 0 complete. Wave 1 (T-002, T-003, T-004, T-005) is unblocked: all dependencies are in the lockfiles, the fixture exists, postgres+redis run via `infra/compose.dev.yml`.
