---
agent: claude-sonnet-5
session: c99eb68e
started: 2026-09-25T1310Z
ended: 2026-09-25T1400Z
scope: apps/web + services/climate (contracts regenerated)
branch: dev
status: done
---

## Did
- PR #83: Map page's legend had no Heat section (gradient bar, matching HeatLayer's
  continuous heatmap-color — not discrete bands like flood/AQI); Flood/Heat simulation maps
  had no legend at all (new FloodLegend/HeatLegend, colors matched to each map's real paint
  stops, not invented); AirQualityPage got a score+badge card matching Flood/HeatPage so all
  three /risks pages read as "the same kind of thing" at a glance.
- PR #83 (climate): the real fix behind "Heat/AQI show no recommendations" — rules.py's
  recommendations() now also returns `allRecommendations` (every fired rule, uncapped)
  alongside the existing `recommendations` (city-wide top 10, untouched — two tests assert
  that cap deliberately). HazardRecommendations filters the new field; a hazard that's
  crowded out of the global top 10 by a bigger one (flood held all 10 slots the day this was
  found) now still shows its own real, lower-priority items. Migration-free (additive
  Pydantic field only, no DB schema change, unlike alerts' migration 003 earlier today).
- PR #83 caught two more process gaps the hard way (again): `ruff check`/`ruff format --check`
  weren't in my local verification loop at all before this — CI failed once on an 111-char
  line. Added them to what I run before pushing climate changes from now on.
- PR #85: HeatPage gets a "Phân giải nhiệt độ hiệu dụng" card (HeatDecomposition) — two terms
  (heat index, UHI) summing exactly to avgEffectiveTemperature, computed from two fields
  HeatLatest already serves (exact subtraction, not a recomputed model — DP3-safe). AQI has
  no analogous decomposition to give (EPA AQI = max of per-pollutant sub-indices, not a
  weighted sum), so added an explanatory note on the existing pollutant chart instead of
  faking one.
- Every FE change this session was checked against LIVE production data first, via a local
  `pnpm dev` with `API_PROXY_TARGET=https://po-ucdt.top` + a gitignored `.env.local` for
  VITE_MAPBOX_TOKEN — the user reviewed each one in their own browser before any push.

## Verified
- `tsc -b --noEmit`, full-repo `npx eslint .`, `vitest run` (91/91) all clean before every
  push in this batch.
- `uv run ruff check .` and `uv run ruff format --check .` now run locally before any climate
  push (added after PR #83's CI catch) — both clean on the final push.
- `uv run pytest` — 218 non-DB tests pass locally; the DB-dependent `climate` CI job (real
  Postgres) went green on PR #83 after the ruff fix, which is the only place the
  allRecommendations backend change could be exercised end-to-end.
- Contracts regenerated (`dump_openapi` + `openapi-typescript`) and diffed by hand for both
  PR #83 (allRecommendations, SimAlert.value) and confirmed not needed again for #85 (no
  backend field added).
- Did NOT verify end-to-end: allRecommendations actually fixing Heat/AQI's empty
  recommendations on the LIVE site — that field doesn't exist on production until this
  reaches main and gets deployed; local preview proxies to the still-old production API, so
  it necessarily still shows empty there. Told the user this explicitly rather than implying
  it was confirmed.

## Next
- User promotes dev -> main (their action) to actually ship: openssl fix, alerts migration
  003, allRecommendations, and everything from this log. Watch the auto-deploy (deploy.yml)
  fire and confirm migration 003 applied + a hazard other than flood shows a recommendation
  once real conditions produce one.
- Known still-open follow-ups (not done, flagged to the user as they came up): root/password
  SSH still open pending the user's own public key; Sentry/error-tracking needs their account;
  ScenarioRecommendations' counterfactual alert preview still shows server Vietnamese text
  (same underlying issue as the persisted Alerts page, fixed there via migration 003 — this
  preview path is a different code path (simulation.py's band_alerts call, never persisted)
  and wasn't in scope for any of today's asks).
