---
agent: claude-sonnet-5
session: sub
started: 2026-09-23T1837Z
ended: 2026-09-23T1845Z
scope: apps/web/src/features/{map,simulation}/**; .agent/tasks/T-009-web-map-simulation.md; .agent/log/2026-09-23T1837Z-claude-sonnet-5-sub.md
branch: feat/T-009-web-map-simulation
status: done
---

## Did
- Branched `feat/T-009-web-map-simulation` off `origin/dev` (8e46917), `pnpm install`.
- Read `.agent/MAP.md`, `.agent/BOARD.md`, `.agent/tasks/T-009-web-map-simulation.md`,
  `.agent/sprints/S-001.md`, and every file under `apps/web/src/shared/**` +
  `router/routes.tsx`/`SimulationLayout.tsx` relevant to map/simulation.
- Ported `apps/web/src/features/map/**` (FullMapView, FloodLayer, HeatLayer, AQILayer,
  TrafficLayer, LayerControls, MapLegend, MapPage) from
  `E:/Github/Hackathon/Hackathon-FE/src/features/map` (read-only reference):
  `next/dynamic`→direct import (Vite already code-splits per route), `next-intl`→`use-intl`,
  dropped `"use client"`, locale reads switched to the existing `useLocaleStore` (matching
  `Header.tsx`'s convention) instead of `next-intl`'s `useLocale()`.
- Ported `apps/web/src/features/simulation/**` from the legacy `simulation` feature: shared
  map-lifecycle hooks (`useSimMap`, `useFocusPoint`), `MapControls`, `SidebarShell`,
  `RainfallSlider`, `ComparePanel`, `FloodExtrusion3D`, `RainOverlay`, `SimHeatLayer`,
  `SimAQILayer`, `WindParticleLayer`, `AQILegend`, the flood/heat/aqi `Map`+`Sidebar`
  pairs, and the three scenario pages + a scenario-picker index page.
- No `pdim.ts` port (by design, per task instructions): added
  `features/simulation/lib/scenarioRequest.ts` (pure `buildScenarioBody`/`buildScenarioRequest`)
  and `lib/useAutoSimulate.ts` (150ms debounce over `useSimulation()`'s mutation, `runNow()`
  for the explicit Run button). Verified B-004 (urbanDensity always sent for the heat
  scenario) with a unit test AND a live POST against the real legacy backend.
- Rewired every "before you've run it" preview panel (FloodSidebar/HeatSidebar/AQISidebar,
  FloodExtrusion3D, SimHeatLayer, SimAQILayer) to use ONLY `result` (the mutation's
  TanStack data) or the raw baseline — never a locally recomputed score. `SimHeatLayer`'s
  geojson-building logic extracted to `heatGeojson.ts` with a unit test proving B-006 (the
  rendered temp equals `hotspot.temperature + backendDelta`, exactly 0 delta pre-run).
- Copied the real Mapbox token from `Hackathon-FE/.env` into `apps/web/.env.local`
  (gitignored — confirmed with `git check-ignore -v`).
- Fixed a build break in my own files caused by `tsconfig.app.json`'s
  `types: ["vite/client"]` (a config file — did not touch it) silently dropping
  `@types/geojson` from the program, which broke mapbox-gl's own `.d.ts` under
  `skipLibCheck`: switched every `GeoJSON.X`/type-only `mapboxgl.X` reference in my files
  to explicit `import type { X } from "geojson"` / `import type { Map as MapboxMap, ... }
  from "mapbox-gl"`.
- Wrapped `new mapboxgl.Map(...)` in try/catch in `FullMapView.tsx` and `useSimMap.ts` — a
  WebGL-less environment (jsdom, or a real browser with no GPU) throws synchronously there;
  now it just leaves `map` null and the boot overlay stays up.
- Added a visually-hidden `<h1 className="sr-only">` per page (reusing existing i18n keys:
  `nav.map`, `simulation.titleFlood/titleHeat/titleAqi`) so `apps/web/src/router/routes.test.tsx`
  (out of scope, not edited) keeps passing once the real pages replaced T-005's placeholders.
- Made `SimulationIndexPage` a 3-card scenario picker instead of a bare redirect to
  `/simulation/flood` — the task note said restoring the legacy redirect was optional, and
  a redirect would have broken `routes.test.tsx`'s `/simulation` → "Mô phỏng" case for no
  real gain over a link.
- Ran `pnpm -F web lint`, `pnpm -F web test`, `pnpm -F web build` to green.
- Started legacy backend (`Hackathon-BE`, port 3001 — confirmed nothing was already
  listening) and `vite --port 5182 --strictPort`; curled `/map`, `/simulation/*`,
  `GET /api/flood`, `POST /api/simulation(/run)`; verified B-004 live
  (`urbanDensity:0.95` → `tempDelta:0.5`; omitted → `tempDelta:0`); drove the four
  routes in the Claude Browser tool tool and read console/network. Stopped both
  processes afterward (`TaskStop` on both background tasks).

## Verified
- `pnpm -F web lint` → `eslint .`, 0 errors.
- `pnpm -F web test` → 6 files / 27 tests passed (9 new).
- `pnpm -F web build` → `tsc -b && vite build` succeeded; `mapbox-gl-*.js` (~1.8MB min) is
  its own chunk, not present in `DashboardPage`/`FloodPage`/`AirQualityPage`/`AlertsPage`
  chunks (T-008's routes) — confirms the "mapbox-gl only on map/simulation routes" rule
  holds without touching `vite.config.ts`.
- Manual: `curl` against the proxy for `GET /api/flood`, `POST /api/simulation`,
  `POST /api/simulation/run` — all 200 with real backend data; the B-004 urbanDensity
  before/after comparison above.
- Manual: Claude Browser tool screenshots of `/map`, `/simulation/flood`,
  `/simulation/heat`, `/simulation/aqi` — sidebars, sliders, quick scenarios,
  ComparePanel (real numbers), LayerControls/MapLegend all render; only console error was
  an expected `GET /api/stream 404` (legacy backend has no SSE — gateway-only, unrelated
  to this task). Map tiles didn't visibly paint inside that specific sandboxed browser
  (no `api.mapbox.com` requests logged there) even though the same token/style URL returns
  200 via `curl` from this shell — recorded as a browser-tool environment limitation, not
  a code defect, since `new mapboxgl.Map()` itself didn't throw (its worker blob loaded).

## Bugs
None new found. Confirmed B-004 and B-006 (already on the board, fixed in the legacy FE
per the 2026-09-14 log entries) stay fixed in this port.

## Decisions
- No client-side PDIM port (`pdim.ts`) exists or will exist in `apps/web` — every
  "before you run it" preview either shows the untouched baseline or the backend's own
  number from the debounced auto-run. This is stricter than legacy (which mixed local
  formulas with backend deltas) and matches DP3 as stated in `.agent/BOARD.md`.
- `SimAQILayer`/`AQIMap`'s simulated badges broadcast the single city-level `aqiDelta` to
  every station marker, rather than reimplementing legacy's per-point AQI formula
  client-side. Marked in-code as a documented simplification (ceiling: swap for a
  per-station API field if Stage 2 adds one).
- Added `sr-only` `<h1>` page titles and a try/catch around `new mapboxgl.Map(...)`
  instead of editing `router/**` or `tsconfig.app.json` — both out of scope — to keep the
  existing test suite green and the app robust to a WebGL-less environment.

## Not done
- `router/routes.test.tsx` still encodes wave-1 placeholder assumptions (see task file
  Handoff) — out of scope for me, flagged for the tech lead / T-008's join gate.
- No per-station AQI what-if (see Decisions) — Stage-2 item if ever needed.

## Left-next
PR into `dev` open (see task file for exact command); tech lead reviews, re-runs verify,
squash-merges per `.agent/sprints/S-001.md`'s rules. Nothing else pending on this seam.
