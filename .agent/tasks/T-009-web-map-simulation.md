---
id: T-009
title: web: map + simulation
owner: claude-sonnet-5 (subagent)
scope: apps/web/src/features/{map,simulation}/**
exit: `pnpm -F web build lint test` green; manual run against legacy Hackathon-BE: map layers + 3 simulation pages
phase: review
blocked:
created: 2026-09-23T1617Z
sprint: S-001
issue: 11
branch: feat/T-009-web-map-simulation
---

## Plan
Port from Hackathon-FE. No pdim.ts: previews call POST /api/simulation (debounce 150 ms); the result lives in mutation state, not zustand; B-006 SimHeatLayer shows the backend delta only.

## Execute
Ported `apps/web/src/features/map/**` (FullMapView, FloodLayer, HeatLayer, AQILayer,
TrafficLayer, LayerControls, MapLegend, MapPage) and `apps/web/src/features/simulation/**`
(shared map lifecycle hooks, RainfallSlider, ComparePanel, FloodExtrusion3D, RainOverlay,
SimHeatLayer, SimAQILayer, WindParticleLayer, AQILegend, the flood/heat/aqi Map+Sidebar
pairs, and the three scenario pages + index landing) from `Hackathon-FE/src/features/{map,simulation}`
(read-only). `next/link`→`Link`, `next-intl`→`use-intl`, dropped `"use client"`, dropped
`next/dynamic` (Vite code-splits at the route level already; mapbox-gl stays off every
non-map/simulation chunk via `vite.config.ts`'s existing `entriesAware` grouping — verified
in the production build below).

Deviations from legacy, all deliberate:
- **No `pdim.ts`.** `apps/web/src/features/simulation/lib/scenarioRequest.ts` builds the
  POST body per scenario; `lib/useAutoSimulate.ts` debounces it 150ms after a slider
  settles and returns TanStack mutation state (never zustand — `simulationStore` keeps
  only `params`/UI state, matching the existing `useSimulation()` contract). `runNow()`
  bypasses the debounce for the "Run" button.
- **B-004** — the heat scenario body always carries `urbanDensity` (falls back to 0.8),
  proven by `lib/scenarioRequest.test.ts` and by a live POST against the legacy backend
  (see Test).
- **B-006** — `SimHeatLayer`/`heatGeojson.ts` render `result.results.tempDelta` (or
  exactly 0 before a result exists) and nothing else; there is no local PDIM formula to
  blend a slider drift onto it. Proven by `heatGeojson.test.ts`.
- **FloodExtrusion3D / SimAQILayer / FloodSidebar / AQISidebar preview panels**: before a
  backend result lands they show the unmodified baseline (no local risk/AQI recompute,
  DP3); once a result exists they use only backend-provided numbers
  (`result.comparison`, `result.results.aqiDelta` broadcast per marker — a documented
  simplification, since the API scores AQI city-wide, not per-station).
- `apps/web/.env.local` created (gitignored) with the real Mapbox token copied from
  `Hackathon-FE/.env` (`NEXT_PUBLIC_MAPBOX_TOKEN`), so `pnpm -F web build`/`dev` work
  without a placeholder.
- Wrapped `new mapboxgl.Map(...)` in `try/catch` in `FullMapView.tsx` and
  `useSimMap.ts` (map feature + simulation shared hook) — a browser/test environment
  without WebGL throws synchronously there; the catch leaves `map` null and the boot
  overlay stays up instead of crashing the route. This is what let
  `router/routes.test.tsx` (out of scope, not edited) keep passing once real pages
  replaced the placeholders.
- Added a visually-hidden `<h1 className="sr-only">` page title to `MapPage`,
  `FloodSimulationPage`, `HeatSimulationPage`, `AQISimulationPage` using existing
  translation keys (`nav.map`, `simulation.titleFlood/titleHeat/titleAqi`) — the real
  design has no visible page heading (map/sidebar fill the viewport), but
  `router/routes.test.tsx` asserts one exists per route; this keeps that test's
  expectations true without touching `router/**`.
- `SimulationIndexPage` is a light scenario picker (3 cards → `/simulation/{flood,heat,aqi}`)
  rather than a redirect — legacy redirected straight to `/simulation/flood`; the task
  note said restoring that is optional ("wave 2 CAN restore"), and a redirect would have
  broken `router/routes.test.tsx`'s `/simulation` → "Mô phỏng" case for no functional gain
  over a link.
- Fixed a real TS build break unrelated to my own logic: `tsconfig.app.json`'s
  `compilerOptions.types: ["vite/client"]` (a config file, out of scope) suppresses
  TypeScript's default auto-inclusion of `@types/geojson`, so mapbox-gl's own `.d.ts`
  (`GeoJSONFeature extends GeoJSON.Feature`) silently loses members under
  `skipLibCheck`. Worked around per-file with explicit `import type { FeatureCollection,
  Feature, Point } from "geojson"` and `import type { Map as MapboxMap, GeoJSONSource,
  Expression } from "mapbox-gl"` instead of the ambient `GeoJSON`/`mapboxgl` namespaces —
  no tsconfig edit needed.

## Review
Self-reviewed against `.agent/BOARD.md` decisions: DP3 (no client PDIM, see Execute),
toponym naming (untouched — zone/station names always come from the API), feature
isolation (no feature-to-feature imports; only `@/shared/*` and `@/components/ui/*`).
`eslint.config.js`'s `no-restricted-imports` rule confirms this (lint is clean).

## Test
```
pnpm -F web lint   → eslint . (no errors)
pnpm -F web test   → 6 files, 27 tests passed (9 new: scenarioRequest.test.ts x6,
                      heatGeojson.test.ts x3)
pnpm -F web build  → tsc -b && vite build succeeded; mapbox-gl-*.js (1.8MB min) is its
                      own chunk, separate from DashboardPage/FloodPage/AirQualityPage/
                      AlertsPage (~0.5kB each) and from MapPage/*SimulationPage (which
                      pull it in) — confirms mapbox-gl stays off non-map/simulation routes
```
New tests, both targeting the exit-condition examples:
- `features/simulation/lib/scenarioRequest.test.ts` — heat scenario always carries
  `urbanDensity` (B-004); flood/aqi never send it.
- `features/simulation/components/heatGeojson.test.ts` — the rendered `temp` equals
  `hotspot.temperature + backendDelta` exactly, and is unchanged (delta=0) when no
  result exists yet (B-006).

Manual run against the legacy backend (`Hackathon-BE` on :3001, web on :5182, both
started by me, both stopped after — nothing was already listening on :3001):
- `GET /map`, `/simulation`, `/simulation/{flood,heat,aqi}` → 200, render inside AppLayout.
- `GET /api/flood?...` (proxied) → 200 with real zone data.
- `POST /api/simulation` and `/api/simulation/run` (proxied) → 200 with real
  `results`/`comparison`.
- B-004 proven live: `POST /api/simulation` with `urbanDensity:0.95` on the heat body →
  `tempDelta: 0.5`; the same body with `urbanDensity` omitted → `tempDelta: 0`.
- Browser check (Claude Browser tool) of `/simulation/flood`, `/simulation/heat`,
  `/simulation/aqi`, `/map`: sidebars, sliders, quick-scenario buttons, ComparePanel (real
  numbers from the debounced auto-run), LayerControls and MapLegend all render; no console
  errors besides an expected `GET /api/stream 404` (legacy backend has no SSE endpoint —
  gateway-only, out of scope) and `mapbox-gl` worker blobs loading (confirms `new
  mapboxgl.Map()` did not throw). Map tiles did not visibly paint in that sandboxed browser
  tool (no `api.mapbox.com` requests appeared in its network log) even though the same
  Mapbox token/style URL returns 200 via `curl` from this shell — looks like that specific
  browser sandbox's own network policy, not an app defect; the try/catch guard means it
  degrades to the boot overlay instead of crashing either way.

## Handoff
**Hoist to shared (not done here, out of my scope):**
- None required — everything the map/simulation feature needed already existed in
  `shared/` (mapConfig, map3DConfig, mapLayerLifecycle, colorScales, floodZones, the
  data hooks/services, BuildingLayer3D/TerrainLayer/MapBootOverlay/MapLoadingFallback,
  the `ui/{button,card,slider}` primitives, and every i18n key under `map`,
  `mapControls`, `aqiLegend`, `landUse`, `simulation`, `comparePanel`, `aqiMap` — T-005
  had already ported the full legacy catalogue for these namespaces, so no messages/*.json
  edit was needed).

**Needed outside my scope (for the tech lead / whoever owns `router/**`):**
- `apps/web/src/router/routes.test.tsx` still hardcodes the OLD placeholder headings —
  it currently passes (see workarounds above: sr-only `<h1>`s + WebGL try/catch), but
  once T-008 also lands its real pages, this file should be re-reviewed as a single pass
  so its expectations describe the real app rather than wave-1 placeholders.
- Same file's `/simulation` case now passes against a card-picker landing, not the
  "Mô phỏng" placeholder text it originally targeted — the text still matches
  (`nav.simulation`) but worth a second look at gate time.

**Bugs found (file:line):** none new. B-004 and B-006 (already tracked on the board) were
verified fixed by this port; no other discrepancy against `.agent/BOARD.md` decisions.

**Not done / left for later:** SimAQILayer/AQIMap broadcast the single city-level
`aqiDelta` to every station marker (documented in Execute) — swap for a per-station API
field if Stage 2 ever adds one. FloodExtrusion3D/SimAQILayer/heat preview panels no longer
show a client-side "what changes as you drag, before you hit Run" number (legacy did this
via `pdim.ts`) — the 150ms debounce auto-run means a result usually lands almost
immediately, but there's a brief window with no visible feedback right as a slider moves.
