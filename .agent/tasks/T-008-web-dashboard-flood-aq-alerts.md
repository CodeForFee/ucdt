---
id: T-008
title: web: dashboard, flood, air-quality, alerts
owner: claude-sonnet-5 (subagent)
scope: apps/web/src/features/{dashboard,flood,air-quality,alerts}/**
exit: `pnpm -F web build lint test` green; manual run against legacy Hackathon-BE shows every card/page
phase: review
blocked:
created: 2026-09-23T1617Z
sprint: S-001
issue: 10
---

## Plan
Port from Hackathon-FE/src/features/*. B-007: 24 h delta only when /api/history has data; B-009 provenance label; B-010 subtractive term; RiskDecomposition shows all 4 R_f terms.

## Execute
Ported four features from `Hackathon-FE/src/features/{dashboard,flood,air-quality,alerts}` (read-only reference) into `apps/web/src/features/*`, converting `next/link`→react-router `Link`, `next-intl`→`use-intl`, dropping `"use client"`, adding default exports (required by `router/lazyPage.tsx`'s `.default`).

Files written:
- `apps/web/src/features/dashboard/pages/DashboardPage.tsx`
- `apps/web/src/features/dashboard/components/{RiskSummaryBanner,OverviewCards,WeatherTrendChart,AQISummaryCard,HeatSummaryCard,FloodSummaryCard,AlertsSummaryCard,RecommendPanel}.tsx`
- `apps/web/src/features/dashboard/lib/weatherOutlook.ts` (+ `.test.ts`)
- `apps/web/src/features/flood/pages/FloodPage.tsx`
- `apps/web/src/features/flood/components/RiskDecomposition.tsx`
- `apps/web/src/features/flood/lib/decomposeFloodRisk.ts` (+ `.test.ts`) — pulled out of the component because `react-refresh/only-export-components` forbids a component file from also exporting a pure function/constant.
- `apps/web/src/features/air-quality/pages/AirQualityPage.tsx`
- `apps/web/src/features/alerts/pages/AlertsPage.tsx`
- `apps/web/src/messages/{vi,en}.json` — added `cards.vs24hTemp`, `cards.vs24hRain`, `cards.stale`; fixed `airQualityPage.source` (see Bugs below)

Legacy bugs carried forward and fixed per the task brief:
- **B-007** (real fix, not just carried over): `weatherOutlook()` in `dashboard/lib/weatherOutlook.ts` calls `useHistory<WeatherData>("weather", 24)`; when it returns entries, the dashboard shows a real 24h delta (`cards.vs24hTemp`/`vs24hRain`), oldest-first entry vs current. When history is empty (still true today — `risk_snapshots` has no `weather` hazard rows), it falls back to the 6h forecast outlook, matching the legacy fix, never a hardcoded number. Unit-tested in `weatherOutlook.test.ts`.
- **B-009**: `floodPage.source` already read "Open-Meteo · PDIM Giai đoạn 1/Stage 1" in the existing message catalogue (fixed by an earlier session) — kept as is.
- **B-010**: `RiskDecomposition`/`decomposeFloodRisk` render the drainage term negative and grow it in the opposite direction from the three additive terms (test asserts `contribution < 0`).
- **B-011**: `decomposeFloodRisk` returns all 4 terms (rainfall/terrain/soil/drainage) with their weights; the component sums them and shows the API's `riskScore` alongside, flagging when the `[0,1]` clamp makes them differ. Weights are a display-only local mirror of `services/climate/climate/pdim/constants.py PDIM_S1.flood` (documented in the module comment) — the served score itself always comes from `useFloodRisk()`, never recomputed.
- **B-005**: renamed `AIRecommendPanel` → `RecommendPanel`; title/copy already say "rule-based" (`dashboard.aiRecommend`/`ruleBasedNote`), and the component renders `ruleId`, `priorityScore` and `inputs` (via `RuleProvenance`) instead of discarding them.
- **New finding, fixed in this PR** (same false-provenance pattern as B-009, in my own scope so fixed directly rather than filed as a new open bug): `airQualityPage.source` said "OpenAQ / MONRE", but `services/climate/climate/pdim/aqi.py::raw_from_open_meteo` sources AQI from Open-Meteo, not OpenAQ/MONRE. Changed to "Open-Meteo · PDIM Giai đoạn 1/Stage 1" to match the flood page's (correct) label.

DP3 compliance:
- Flood/AQI risk *levels* shown via `RiskBadge` always come from the API as a string (`FloodData.overallRisk`, `FloodArea.riskLevel`) — never computed from a raw score client-side (per `shared/constants/riskLevels.ts`'s DP3 note). Dropped the legacy `getRiskLevel(score)`/ad hoc `aqi.category` string-matching, which don't exist in `apps/web/src/shared` on purpose.
- AQI colour-banding uses `shared/lib/aqi.ts` (`aqiCode`/`aqiColor`) — the one EPA-breakpoint source already built for this — instead of re-declaring thresholds per component.
- The flood term decomposition (`decomposeFloodRisk`) is presentational only: it explains the already-served `riskScore`, using the raw `triggers` the API sends and the published (not re-derived) PDIM Stage-1 weights; nothing else in the UI consumes its output.
- New optional `observedAt`/`stale` fields on `/latest` payloads: read via a local `WithFreshness<T>` type intersection in `OverviewCards.tsx`, `FloodPage.tsx`, `AirQualityPage.tsx` (shared types weren't touched — see Handoff). Renders a small amber "stale" tag (`cards.stale`) only when `stale === true`; absent on the legacy backend, so nothing breaks against it.

Fixed a router-test hazard while porting: the legacy `FloodPage`/`AirQualityPage` returned a bare `<LoadingSkeleton/>` (no heading at all) whenever `isLoading` was true, gating the entire page — including the `<h1>` — behind the query. `router/routes.test.tsx` (out of scope, not touched) asserts each route's heading renders, so with real network calls now firing, a page that hides its own `<h1>` while loading would time out that test. Restructured both pages so the header (title + subtitle + `DataSourceTag`) renders unconditionally and only the body is gated on `isLoading`/`isError` — `AlertsPage`/`DashboardPage` already did this.

## Review
Self-reviewed against `.agent/BOARD.md` Decisions (4-tab nav untouched — dashboard/flood/air-quality/alerts don't touch `router/**`; full R_f decomposition with weights; toponym-only naming — flood zone names come from the API, nothing renamed here; DP3) and `apps/web/eslint.config.js` feature isolation (no `@/features/{other}` imports; verified by `pnpm -F web lint`).

## Test
```
$ pnpm -F web lint
> eslint .
(no output — clean)

$ pnpm -F web test
 Test Files  6 passed (6)
      Tests  25 passed (25)

$ pnpm -F web build
> tsc -b && vite build
✓ 2837 modules transformed.
✓ built in 5.48s
```
New tests: `apps/web/src/features/flood/lib/decomposeFloodRisk.test.ts` (sums to R_f, drainage term negative, clamping), `apps/web/src/features/dashboard/lib/weatherOutlook.test.ts` (B-007: history present → real 24h delta; history empty/undefined → forecast fallback; nothing available → `null`, never fabricated).

Manual run: see the session log for the exact commands and what the proxied `/api/*` endpoints returned against the legacy `Hackathon-BE` server on :3001 and vite on :5181.

## Handoff
Hoist to shared (not done here — out of scope, small enough to defer):
- A tiny `<StaleTag>`/`isStale()` helper is duplicated (as a 2-3 line inline check) across `dashboard/components/OverviewCards.tsx`, `flood/pages/FloodPage.tsx`, `air-quality/pages/AirQualityPage.tsx` because `apps/web/src/shared/**` is out of my scope and features can't import each other. Worth a `shared/components/common/StaleTag.tsx` + `shared/types` addition of `observedAt?`/`stale?` once T-007's climate-api contract is final.
- `shared/types/{weather,aqi,flood,heat}.ts` don't declare `observedAt`/`stale` yet — every read of them in my features goes through a local `WithFreshness<T>` intersection type rather than editing shared types (out of scope). Once packages/contracts (T-007) generates real types with these fields, the local casts can be deleted.

Nothing else needed outside scope. No new dependencies added.

**Blocker found at PR-creation time (not caused by this session):** `gh pr create --base dev`
failed with "No commits between dev and feat/T-008-...". `git ls-remote origin` and
`gh api repos/CodeForFee/ucdt/branches` confirm the remote now has only two branches, `main`
and `feat/T-008-web-dashboard-flood-aq-alerts` — `dev` and every other wave-2 feature branch
(`feat/T-006-ingest-worker`, `feat/T-007-climate-api-contracts`, etc.) are gone. `main`'s tip is
a merge commit "Dev (#25)" at 2026-09-23T18:30:48Z — `dev` was merged into `main` (PR #25) and
the branches were evidently cleaned up right around when this session finished its own commit.
This branch (`feat/T-008-...`) was cut from `origin/dev` before that merge, so it does not yet
contain whatever else landed in that merge.

I did not delete anything and did not create/merge into `dev` or `main` — this happened outside
this session. Per the task's own rules ("agents never push or merge to main") I stopped short
of opening a PR against `main` or recreating `dev` myself; both are decisions for the tech lead/
user. My commit `56b20bf` is pushed to `feat/T-008-web-dashboard-flood-aq-alerts` on origin and
ready — someone with the authority to decide the new target branch (recreate `dev` from `main`,
or explicitly redirect this PR to `main`) needs to say which, then `gh pr create --base <branch>`
from this same commit finishes the job in one command.


**Lead note (2026-09-23T1850Z):** unblocked. The maintainer squash-merged dev into main (#25) and auto-delete removed `dev`; the lead re-pushed `dev` = `main` (51d9079), rebased these commits onto it, and opened the PR from `feat/T-008-web-pages`. Follow-up: `FLOOD_WEIGHTS` in `features/flood/lib/decomposeFloodRisk.ts` duplicates PDIM coefficients with no cross-check → B-014 (climate should serve the decomposed terms).
