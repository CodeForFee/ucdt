---
id: T-005
title: web shell + shared
owner: claude-sonnet-5 (subagent)
scope: apps/web/** (except package.json; inside src/features/** only placeholder */pages/*Page.tsx), .github/workflows/web.yml
exit: `pnpm -F web build && pnpm -F web lint && pnpm -F web test` green
phase: review
blocked:
created: 2026-09-23T1617Z
sprint: S-001
issue: 6
---

## Plan
Structure of E:/Github/KLTN_dev-v2/frontend: main.tsx, App.tsx, config/env.ts (zod), router/{index,lazyPage,RouteErrorBoundary}, components/ui (shadcn), lib/utils.ts, eslint feature isolation, vite.config (chunk groups + React Compiler + /api proxy). Port Hackathon-FE/src/shared/** (types, services, hooks, components/{layout,charts,common,map}, lib minus pdim.ts, stores UI-only, utils/queryKeys) + useLiveEvents (EventSource /api/stream -> invalidateQueries) + i18n via use-intl with messages/{vi,en}.json. All routes wired to placeholder pages.

## Execute
Subagent (claude-sonnet-5) wrote the shell and shared layer, then its session ended before commit. Tech lead (claude-opus-5, session 2026-09-24) verified the uncommitted worktree as-is and committed it unchanged.
- Shell: main.tsx, App.tsx, config/env.ts (zod), router/{index,routes,lazyPage,RouteErrorBoundary,SimulationLayout,NotFoundPage}, components/ui (shadcn: badge, button, card, select, sheet, slider, tabs), lib/utils.ts, vite + vitest + eslint configs.
- Shared: types, services, hooks (incl. useLiveEvents: EventSource /api/stream -> invalidateQueries), components/{layout,charts,common,map}, lib (no pdim.ts), stores, utils/queryKeys, messages/{vi,en}.json.
- Every route wired to a placeholder page under src/features/*/pages/.
- CI: web.yml runs lint, test, build.

## Review
- DP3: grep for PDIM coefficients / pdim in apps/web/src -> none. `shared/lib/aqi.ts` holds EPA display bands (colour + label), not a PDIM term.
- Scope: only apps/web/** (package.json untouched) and .github/workflows/web.yml.

## Test
```
pnpm -F web lint   -> exit 0
pnpm -F web test   -> 4 files, 19 tests passed
pnpm -F web build  -> built in 2.65s (VITE_MAPBOX_TOKEN placeholder)
```

## Handoff
Wave-2 T-008/T-009 fill the placeholder pages; they must consume shared/ hooks and never recompute a value climate owns.
