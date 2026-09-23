---
id: T-005
title: web shell + shared
owner: claude-sonnet-5 (subagent)
scope: apps/web/** (except package.json; inside src/features/** only placeholder */pages/*Page.tsx), .github/workflows/web.yml
exit: `pnpm -F web build && pnpm -F web lint && pnpm -F web test` green
phase: plan
blocked:
created: 2026-09-23T1617Z
sprint: S-001
issue: 6
---

## Plan
Structure of E:/Github/KLTN_dev-v2/frontend: main.tsx, App.tsx, config/env.ts (zod), router/{index,lazyPage,RouteErrorBoundary}, components/ui (shadcn), lib/utils.ts, eslint feature isolation, vite.config (chunk groups + React Compiler + /api proxy). Port Hackathon-FE/src/shared/** (types, services, hooks, components/{layout,charts,common,map}, lib minus pdim.ts, stores UI-only, utils/queryKeys) + useLiveEvents (EventSource /api/stream -> invalidateQueries) + i18n via use-intl with messages/{vi,en}.json. All routes wired to placeholder pages.

## Execute
## Review
## Test
## Handoff
