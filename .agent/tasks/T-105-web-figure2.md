---
id: T-105
title: web: every Figure-2 presentation box
owner: claude-opus-5 (subagent)
scope: apps/web/**
exit: `pnpm -F web lint && test && build` green; headless check lists each §J item as present
phase: review
blocked:
created: 2026-09-24T0330Z
sprint: S-002
issue: 50
---

## Plan
Spec §J. Mid-task user requirement (2026-09-24, via the lead): recommendations get their own
nav tab (5 tabs), alerts move from the overview into a header bell dropdown.

## Execute
- **Contracts.** `shared/types/*` are now aliases of `@ucdt/contracts` `components["schemas"]`
  (flood, heat, aqi, alerts, recommend, simulation, weather, new maturity). `web` has no
  `@ucdt/contracts` dependency, so `tsconfig.app.json` maps the name to
  `../../packages/contracts/src/index.ts` (type-only imports; Vite never resolves them).
- **Flood (§B, B-014).** `features/flood/lib/decomposeFloodRisk.ts` + its test deleted — the web
  holds no PDIM weight. `RiskDecomposition` renders the SERVED `decomposition` (weight, x̃,
  contribution), drainage drawn leftward as the subtractive term, labels per spec with data
  source notes (Open-Meteo / Copernicus DEM / ESA WorldCover / expert constant). Flood page: city
  decomposition by default, click a zone row for that zone's served terms; P(i) column. Flood
  summary card and flood-sim preview: soilSaturation → terrain (DEM) + imperviousness
  (WorldCover) + drainage (expert).
- **Heat (§C).** Store no longer defaults to 0.8 / 30 %: `greenCoverage` / `urbanDensity` stay
  undefined until moved; `BaselineSliders` show the served ρ₀ / G₀ and name WorldCover.
  `scenarioRequest.ts` had ΔG = G − 0.30 hard-coded (wrong vs §C/§G, where `addGreenCoverage`
  is pp vs the served G₀); now ΔG = G − G₀ (`greenDeltaPp`, 1 dp) for all three simulators, and
  an untouched density slider omits `urbanDensity` (API scores it at ρ₀). No ΔT in the web.
- **AQI (§D, §I.3).** Map page `AQILayer`: second source/layer for `observedStations`
  (small, dark-ringed circle) + legend "Trạm quan trắc (AirGradient)". AQI simulator:
  `ObservedStationsLayer` markers (white, dashed ring, popup) always shown, legend entry;
  `SimAQILayer` point markers use served `results.stations` after-values instead of broadcasting
  the city delta. Air-quality page lists the stations (AQI, PM2.5, time, nearest CAMS point by
  toponym). CAMS points relabelled "Điểm AQI (CAMS)" — they are modelled, not stations. The
  never-served `trend7d` / `hourlyPattern` / `dominantPollutant` branches removed.
- **Recommendations (§E).** New feature `features/recommendations` + route `/recommendations`
  + 5th nav tab "Khuyến nghị"/"Recommendations": rank, toponym, unit kind, rule, π, title,
  message, actions, inputs under "Vì sao" (E(i) named as WorldCover), firedCount note. `commune`
  and the `aqiPointId` join key are never rendered. Removed from the dashboard.
- **Alerts (§F).** `AlertsBell` in the header: unread badge, dropdown (severity, toponym via
  `/api/units` joined on the §F id's unitId, title, time), per-item and all mark-read
  (`POST /api/alerts/read`), empty state, "Tất cả" → `/alerts`; live via the existing
  `alert.created` invalidation. Alerts card removed from the dashboard. No "system"/"info".
- **Maturity (§H).** `useMaturity` + `fetchMaturity` + `QUERY_KEY.maturity`; an aqi
  `snapshot.updated` also invalidates maturity. Dashboard `MaturityCard`: active stage per
  hazard, each stage's criteria current/required with bar + reason, S1 holdout MAE when not
  null, S2 γ estimates with 95 % CI + MAE + promoted, δ, W, evaluatedAt. Dashboard also lists
  data-layer provenance.
- **Simulators (§G).** `ScenarioRecommendations` "Khuyến nghị cho kịch bản" in all three
  sidebars: counterfactual top-k (rank, toponym, rule, π) + firedCount, band changes
  before → after per unit, would-fire alerts; AQI adds per-point before/after from
  `results.stations` (replaces the client-computed station list).
- i18n (vi/en): new namespaces bands, maturity, scenarioRec, recInputs, unitKind, recommendations,
  alertsBell; info-modal text no longer says "bão hòa đất", "phường" or ρ − 0.8.

## Review
- `infra/web.Dockerfile` copies only `apps/web`; `pnpm -F web build` runs `tsc -b`, which now
  needs `packages/contracts`. The image build (skipped today: no VITE_MAPBOX_TOKEN secret) needs
  `COPY packages/contracts packages/contracts` — outside my scope. Adding `@ucdt/contracts` to
  web's package.json would be the cleaner fix (lead decision).
- API gap: `Alert` carries no `unitId`/`unitName` (SimAlert does); the bell parses the §F id and
  joins `/api/units`. A field on `Alert` would remove the parse.
- The heat-cell list and the city AQI marker still add the served ΔT / ΔAQI to the served
  baselines (pre-existing, uniform deltas). Info-modal text still quotes coefficients (B-017
  territory).
- Nav is 5 tabs now: the board's 2026-09-14 4-tab Decision needs replacing (lead).

## Test
```
$ pnpm -F web lint                                  → exit 0
$ pnpm -F web exec tsc -b                           → exit 0
$ pnpm -F web test                                  → Test Files 17 passed (17), Tests 86 passed (86)
$ VITE_MAPBOX_TOKEN=pk.x pnpm -F web build          → ✓ built, exit 0
```
New tests: RiskDecomposition (served terms, weights, drainage leftward, sum), MaturityCard,
ScenarioRecommendations, ObservedStationsList, HeatSidebar sliders at ρ₀/G₀, scenarioRequest
ΔG vs served G₀, useLiveEvents maturity invalidation, AlertsBell (badge, list, mark one/all,
empty), RecommendationsPage, routes (5 tabs, /recommendations, bell), and `src/test/nameGuard`
(dashboard, recommendations tab, open alerts dropdown, flood page, observed stations, 3
simulators × vi/en; fixtures carry "Phường Bình Thạnh"/"Xã Nhà Bè" communes). The guard was
mutation-checked: rendering `rec.commune` makes it fail (2 failed).

Live: `vite` dev (API_PROXY_TARGET=http://localhost) + headless Chrome over CDP, every page:
```
nav: /dashboard,/map,/simulation,/flood,/recommendations
/dashboard: missing=[] · admin=[]          (maturity card, provenance, bell dropdown empty state)
/recommendations: missing=[] · admin=[]
/flood: missing=[] · admin=[]
/air-quality: missing=[] · admin=[]        (AirGradient station "CMT8")
/alerts: missing=[] · admin=[]             (no active alerts live)
/simulation/heat: missing=[] · admin=[]    (ρ₀ 70.8 %, G₀ 21.8 %, counterfactual panel)
/simulation/flood: missing=[] · admin=[]
/simulation/aqi: missing=[] · admin=[]     (per-point before → after)
/map: missing=["Trạm quan trắc (AirGradient)"]  — map never boots with a placeholder token
```
Map tiles and Mapbox layers (map page + simulator maps) NOT checked: no real Mapbox token.

## Handoff
- PR into dev; see Review for the Dockerfile line, the Alert unitId gap and the nav Decision.
- Live alert list was empty during the check, so the bell's populated state is covered by unit
  tests only.
