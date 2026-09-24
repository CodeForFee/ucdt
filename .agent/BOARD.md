# Board — Urban Climate Digital Twin (PO-UCDT)

## Roster
| provider | can | cost | use for |
|---|---|---|---|
| antigravity | repo-wide, shell, code, full-stack | high | architecture, multi-file refactor, verification |
| cursor / codex | open files, inline edits | low | single-file edits, stubs |
| commands | pnpm test, pnpm typecheck, pnpm build, pnpm lint | free | mechanical correctness gates |
| claude subagents (Agent tool) | repo, shell, git worktree, gh | opus = strong, sonnet = cheap | sprint seams; each on its own branch + PR |

## Now (claims)
- (none — S-002 closed 2026-09-24T1540Z; claude-opus-5 released the whole-repo claim.) Only the tech lead edits this board; seam owners edit only their task scope, their task file and their own log.

**Git flow (user decision 2026-09-23):** one GitHub issue per task → branch `feat/T-NNN-<slug>` → PR **into `dev`** → tech lead reviews + squash-merges into `dev`, then closes the issue. **`main` belongs to the user** — agents never push or merge to main. `.agent/` lives in the repo (moved from the workspace root 2026-09-23); seam owners commit their task file + log inside their own PR, the lead commits board updates in the wave-gate PR.

**`dev` after a promotion (2026-09-23):** the user promotes by squash-merging `dev` → `main`, and the repo has "Automatically delete head branches" ON, so `dev` disappears after each promotion (#25). The lead re-creates it as `dev = main` (`git push origin origin/main:refs/heads/dev`) and rebases open feature branches with `git rebase --onto origin/dev <old dev tip>`, pushing to a NEW branch name (no force-push). **The setting was turned OFF 2026-09-24 (user decision)**, so a promotion no longer deletes `dev`; still check `git ls-remote --heads origin dev` before opening PRs.

**Branches are never deleted** (user rule 2026-09-23): merge with `gh pr merge --squash`, no `--delete-branch`, no `git push --delete`.

**Merge only on the unpiped exit status of `gh pr checks <n> --watch`** (2026-09-24): `gh pr checks … | tail && gh pr merge` merged #33 with `web` red, because the pipe's exit status is tail's. Capture `rc=$?` from the unpiped command and merge only on 0.

**Lost:** the three legacy logs (2026-08-19T0900Z-antigravity, 2026-09-14T0730Z/0750Z-claude-opus-5) vanished from the old workspace-root `.agent/log/` during this session before the move — not deleted by any command run here, not in the Recycle Bin. Their substance survives in Bugs, Decisions and handoffs below.

## Tasks (S-001 · UCDT v2 monorepo — `.agent/sprints/S-001.md`)
| id | issue | title | wave | owner | phase |
|---|---|---|---|---|---|
| T-001 | #2 | scaffold + interfaces | 0 | claude-opus-5 | done |
| T-002 | #3 | PDIM logic port (Python) | 1 | claude-opus-5 (sub) | done |
| T-003 | #4 | DB schema + repo | 1 | claude-opus-5 (sub) | done |
| T-004 | #5 | gateway (Bun + Hono) | 1 | claude-sonnet-5 (sub) | done |
| T-005 | #6 | web shell + shared | 1 | claude-sonnet-5 (sub) → lead | done |
| T-011 | #7 | godkit-map for ucdt/ | 1-gate | claude-opus-5 | done |
| T-006 | #8 | ingest + worker | 2 | claude-opus-5 (sub) | done |
| T-007 | #9 | climate-api + contracts | 2 | claude-opus-5 (sub) | done |
| T-008 | #10 | web: dashboard, flood, air-quality, alerts | 2 | claude-sonnet-5 (sub) | done |
| T-009 | #11 | web: map + simulation | 2 | claude-sonnet-5 (sub) | done |
| T-010 | #12 | full-stack compose + Caddy | 3 | claude-opus-5 | done |
| T-012 | #13 | CI complete + GHCR | 4 | claude-sonnet-5 (sub) | done |
| T-013 | #14 | deploy + backup + DEPLOY.md | 4 | claude-sonnet-5 (sub) | done |

## Tasks (S-002 · Figure 2 fidelity — `.agent/sprints/S-002.md`, spec `S-002-spec.md`)
| id | issue | title | wave | owner | phase |
|---|---|---|---|---|---|
| T-101 | #46 | static layers (DEM, WorldCover, OSM) + toponym renames | 1 | claude-opus-5 (sub) | done (#58) |
| T-102 | #47 | ingestion: per-unit weather + AirGradient open network | 1 | claude-opus-5 (sub) | done (#56) |
| T-103 | #48 | processing: per-unit PDIM, π(r,i), per-unit alerts, counterfactual, Algorithm 1 | 2 | claude-opus-5 (sub) | done (#60) |
| T-104 | #49 | API + contracts + gateway | 3 | claude-opus-5 (sub) | done (#61 #62) |
| T-105 | #50 | web: every Figure-2 presentation box | 4 | claude-opus-5 (sub) | done (#63) |
| T-106 | #51 | manuscript §3.1 end, §4.2, Data statement → draft(4).docx | 5 | claude-opus-5 | done (docs/PO-UCDT draft(4).docx; closed by the gate PR) |

**Chờ người dùng:** (1) `docs/PO-UCDT draft(4).docx` — Tuyên bố về dữ liệu còn các chỗ `[Tác giả xác nhận: …]` cần tác giả điền. (2) `docs/PO-UCDT draft(3).docx` vẫn chưa được thay bằng `docs/.draft3.tmp.docx` (Word đang giữ file hôm 2026-09-14). (3) Promote `dev` → `main` khi duyệt xong S-002. The VITE_MAPBOX_TOKEN secret exists since 2026-09-24T0506Z and the web image now builds in CI.

## Bugs
- [x] B-020 Heat simulation preview card compared two different quantities: its circles showed `avgTemperature` (measured AIR temperature, e.g. 27.7°) plus ΔT, while the zone list and ΔT itself are EFFECTIVE temperatures (T_eff = HI + ρ·3.5 °C, ~35°). **User decision 2026-09-24: match docs/PO-UCDT draft(3).docx** — §4.2 defines ΔT as a perturbation of T_eff. Fixed 2026-09-24 claude-opus-5: climate serves `avgEffectiveTemperature` (mean served cell T_eff, `pdim.heat.mean_effective_temp`, additive field; legacy keys unchanged), the card headlines it and T_eff + ΔT with the formula shown, and waits rather than falling back to air temperature on older snapshots. Also per the draft's heat-module text, the heat simulation map now opens on the satellite basemap. Live: air 27.7 / mean T_eff 34.6 (cells 34.55) / card 34.6 → 27.1 at ΔT −7.5.
- [x] B-019 AQI/heat preview circles misaligned in the simulation sidebar (category label only under "Hiện tại"; connector centred on the row, not the circles). Fixed 2026-09-24 claude-opus-5 (#41): items-start, equal-width side columns, h-14 middle column, category always shown. Headless check: circle centres equal (AQI 270/270, heat 254/254).
- [x] B-018 Dragging any simulation slider made the whole screen jump: TanStack resets mutation `data` to undefined on every `mutate()`, and `useAutoSimulate` passed it through, so each tick unmounted map result layers, flashed the idle hint and collapsed ComparePanel; `FloodExtrusion3D` also tore down its layers per result and `RainOverlay` rebuilt its canvas per tick. Fixed 2026-09-24 claude-opus-5 (#40): last settled result kept (sequence-guarded against stale responses), layers upserted via setData, rain canvas built once. Regression tests fail 2/3 on the old hook; headless probe: 0 panel drops / 0 idle flashes in 80 samples per page.
- [ ] B-017 Simulation info-modal text asserts mechanisms the Stage-1 model does not implement (`apps/web/src/messages/{vi,en}.json` `comparePanel`): `floodRiskImpactDesc` says heat changes flood risk via evaporation/rain cycles (the heat scenario moves R_f only through green cover → drainage); `heatIntro` says effective temperature includes traffic (no traffic term in ΔT, PDIM 4.2(ii)); `tempDeltaAqiDesc` says temperature drives ozone/AQI (no temperature term in the AQI what-if). Found 2026-09-24 claude-opus-5 while fixing B-016. Text-only fix; not yet scheduled.
- [x] B-016 Simulation showed "affected population" (and buildings) as if measured — the legacy heuristic 50k / 80k people and 1,200 buildings per affected zone, with info text claiming a building-density overlay / district population density. Conflicted with Decision 2026-09-14. **User decision 2026-09-24: drop from the UI.** API keeps the fields (legacy parity); web no longer renders them; i18n strings removed; regression test fails 3/3 on the old component. Fixed 2026-09-24 claude-opus-5 (#32).
- [x] B-015 Dashboard showed "±x vs 24 h ago" from history only minutes deep (`features/dashboard/lib/weatherOutlook.ts` used `history[0]` regardless of age) — a B-007-class false claim that appeared as soon as T-006 started writing weather snapshots. Fixed 2026-09-23 claude-opus-5 (W2 gate PR): delta only when history spans >= 23 h, regression test.
- [x] B-014 `apps/web/src/features/flood/lib/decomposeFloodRisk.ts` copied the PDIM flood weights with no cross-check (DP3). Fixed in S-002: climate serves `decomposition` for the city and every zone (spec §B, T-103 #60), the web renders it and the file is deleted (T-105 #63). #26.
- [x] B-013 `apps/gateway/src/index.ts` gave one Bun RedisClient to both cache/rate-limit and `/api/stream`; a subscribed connection rejects every other command, so after the first SSE client both middlewares failed open (no cache, no rate limit). Tests missed it: the fake allowed commands in subscriber mode. Fixed 2026-09-23 claude-opus-5 (#20, PR #21): dedicated subscriber connection, fake enforces subscriber mode, regression test.
- [x] B-012 `Hackathon-BE/src/utils/dataTransformer.ts` `transformOpenMeteoResponse` finds the "current hour" by matching `now.toISOString()` (UTC) against Open-Meteo `hourly.time`, which is requested in `Asia/Ho_Chi_Minh` local time — so "current" weather and the 24 h forecast start 7 h in the past (falls back to index 0 before 07:00 local). Found 2026-09-23 claude-opus-5 while planning S-001. Legacy repo is frozen. Fixed in ucdt T-006 (#23, `climate/ingest/weather.py` matches the HCMC local hour via utc_offset_seconds; regression test fails with the legacy logic).
- [x] B-009 Flood page credited data to "VNMHA / VnDMS"; the backend contacts neither — flood risk is computed locally from Open-Meteo precipitation (googleFlood.client.ts does no network I/O). False provenance in a paper screenshot. Fixed 2026-09-14 claude-opus-5 (log 2026-09-14T0750Z-claude-opus-5)
- [x] B-010 Flood trigger chart plotted mm/h beside % on one axis as "current vs threshold", implying higher-is-worse for drainage — the SUBTRACTIVE term. 50 mm/h was mislabelled "threshold" (it is P_ref). Fixed 2026-09-14 claude-opus-5
- [x] B-011 `/api/flood` returned only 3 of R_f's 4 terms (terrainSensitivity missing), so the displayed factors summed to 0.0825 against a displayed score of 0.232 — the DP3 audit claim for that screen was unverifiable. Fixed 2026-09-14 claude-opus-5
- [x] B-004 `urbanDensity` never copied from the request by either simulation controller — UHI term of `tempDelta` identically zero over HTTP, density slider inert. Fixed 2026-09-14 claude-opus-5 (log 2026-09-14T0730Z-claude-opus-5)
- [x] B-005 Recommendation panel titled "AI Recommendations" over a rule-based engine, and discarded `ruleId`/`priorityScore`/`inputs` that the API already sends — Section 4.2(iii) traceability claim was false. Fixed 2026-09-14 claude-opus-5
- [x] B-006 `SimHeatLayer` blended local slider drift onto the backend delta, so the map showed a number the processing layer never computed (breaks DP3). Fixed 2026-09-14 claude-opus-5
- [x] B-007 `OverviewCards` rendered hardcoded `+1.2 °C vs yesterday` / `-5.3 mm vs average` as if measured; no historical data exists in the data layer. Replaced with a real 6 h forecast outlook. Fixed 2026-09-14 claude-opus-5
- [x] B-008 Non-uniform S(b) -> priority mapping (R-HEAT-01 S=4 emitting 'high'; R-HEAT-02 S=2) and R-NORM-01 bypassing pi() with a literal. Fixed 2026-09-14 claude-opus-5
- [x] B-001 TS18046 type error in `Hackathon-BE/src/external/iqair.client.ts` — fixed 2026-08-19 antigravity (log 2026-08-19T0900Z-antigravity)
- [x] B-002 Missing automated test suite in `Hackathon-BE` — fixed 2026-08-19 antigravity (log 2026-08-19T0900Z-antigravity)
- [x] B-003 Verify full sync of PDIM S1 formulas between BE & FE (`constants.ts` vs `pdim.ts`) — fixed 2026-08-19 antigravity (log 2026-08-19T0900Z-antigravity)

## Decisions
- 2026-09-24 (S-002) Figure 2 of the PO-UCDT manuscript is authoritative (user: "phải làm theo cái hình … 100% matching"). `.agent/sprints/S-002-spec.md` is normative for BOTH the code and manuscript §4.2; a seam that finds the spec wrong stops, the lead amends the spec first (#53–#59), then code and manuscript follow.
- 2026-09-24 (S-002) Nav carries FIVE tabs: Dashboard, Map, Simulation, Flood, Recommendations (user: "ranked là 1 tab"). Alerts live in a header bell with an unread badge and a dropdown ("alerts là dropdown icon ở header, không để ở overview"); `/alerts` and `/air-quality` stay reachable by URL. The overview carries neither recommendations nor alerts. Supersedes 2026-09-14 "four tabs". draft(4) names no tab, so no manuscript change was needed.
- 2026-09-24 (S-002) E(i) in π(r,i) = clamp(builtUp(i), 0.1, 1), the ESA WorldCover built-up fraction of the unit (a documented exposure PROXY, not a population model). Supersedes 2026-09-14 `min(1, 0.4 + 0.1·|affected zones|)`. Population/buildings stay out of the UI (B-016).
- 2026-09-24 (S-002) `commune` (official 2025 commune-level name, "Phường …"/"Xã …"/"Đặc khu …") is API/data-only and never rendered: those names reuse the abolished district words. Units are shown by toponym; the 12 district-named heat cells were renamed to street/landmark toponyms at the same coordinates (migration 002). Guarded by `climate/ingest/names.py` and `apps/web/src/test/nameGuard.test.tsx`.
- 2026-09-24 (S-002) Data layer is keyless/free only (user: "không muốn mất phí"): Open-Meteo (forecast per unit, CAMS air quality, Elevation = Copernicus DEM GLO-90), AirGradient open network, ESA WorldCover 2021 v200, OSM Overpass. Static layers are derived once by `climate/spatial/derive.py` into the committed `derived.json` with provenance; the worker never re-derives them.
- 2026-09-24 (S-002) What-if = Algorithm 2 step 7: the counterfactual state re-runs scoring, alerts (returned, never persisted) and the ranked rules; every simulator shows "Khuyến nghị cho kịch bản". The web sends ΔG against the SERVED G₀ and omits an untouched density (scored at ρ₀); it never computes ΔT/ΔAQI.
- 2026-09-24 (S-001 W4) Image contract: `images.yml` publishes ghcr.io/codeforfee/ucdt-{climate,gateway,web} tagged `<branch>` (dev/main), `sha-<short>`, and `latest` on main; PRs build without pushing. Production runs `infra/compose.yml` + `infra/compose.prod.yml` (images pinned by `UCDT_TAG`, default `main`; rollback = `UCDT_TAG=sha-…`) via `infra/deploy.sh` — the VPS never builds. The web image bakes the Mapbox token at build time, so it is only published once the `VITE_MAPBOX_TOKEN` repo secret exists (the job skips with a warning, never builds with a placeholder).
- 2026-09-24 (S-001 W4) `packages/contracts` is enforced, not advisory: the `climate` CI job regenerates it from the climate OpenAPI and fails on any diff.
- 2026-09-24 Shell scripts are committed 100755 (`git update-index --chmod=+x`); a Windows checkout otherwise commits 100644 and Docker Desktop hides it until Linux fails with exit 126 (PR #37).
- 2026-09-23 (S-001 W2) Snapshot contract between worker and API: every run writes five `risk_snapshots` (hazard ∈ weather, aqi, flood, heat, recommend), `result` = exactly the legacy Hackathon-BE `/api/<hazard>` `data` payload (heat in heatController's reshaped form), `model_version` = `pdim-s1`, `inputs` = what the models consumed. `/v1/<hazard>/latest` adds `observedAt` + `stale` (> 45 min) and returns 503 before the first snapshot. A failed upstream fetch writes nothing.
- 2026-09-23 (S-001 W2) Each DB test suite owns its database (`ucdt_test` tests/db, `ucdt_test_api`, `ucdt_test_worker`): tests/db downgrades its DB to base, so a shared one races across parallel worktrees.
- 2026-09-23 (S-001 W1) Python `services/climate` is the ONLY owner of PDIM coefficients and formulas; `apps/web` has no `pdim.ts` and never recomputes a served value. The gateway (Bun + Hono) never touches the DB and never computes a domain value — it forwards, envelopes, caches, rate-limits and relays SSE. Parity with the legacy TS backend is proven by `tests/pdim/test_pdim_parity.py` against `parity.json` (1e-9).
- 2026-09-23 (S-001 W1) Live-update contract: the worker publishes JSON on Redis channel `ucdt:events` with `type` ∈ {`snapshot.updated`, `alert.created`} and, for snapshots, `hazard` ∈ web `KEY` (weather, aqi, flood, heat, recommend). The gateway uses `type` as the SSE event name; `useLiveEvents` invalidates by it. Any other shape is silently ignored.
- 2026-09-23 Redis pub/sub always gets its own connection — never share a subscribed client with key commands (B-013).
- 2026-09-14 (SUPERSEDED 2026-09-24 by the five-tab nav) Nav carries four tabs: Dashboard, Map, Simulation, Flood. Air-quality and alerts are represented by dashboard cards; their detail pages stay reachable by URL. §4.3/§4.4.2 of the manuscript were reworded to match — do not reinstate the "first-class nav tab" claim without also changing the nav.
- 2026-09-14 Any UI that claims to decompose a composite score must show EVERY term with its weight, sum them, and render subtractive terms in the opposite direction. A partial decomposition is worse than none: it invites a reader to add up numbers that cannot reproduce the score.
- 2026-09-14 Spatial units are named by coordinate-anchored TOPONYMS, never by administrative units. Resolution 1685/NQ-UBTVQH15 (2025) abolished the district tier in HCMC (168 commune-level units). `id` fields keep their historic slugs as internal keys only. Guarded by tests/spatialNaming.test.ts and an API-surface assertion.
- 2026-09-14 DP3 is enforced architecturally, not by convention: every coefficient lives in ONE constants module per repo, cross-checked by tests on both sides; the presentation layer must never compute a substitute for a value the processing layer owns.
- 2026-09-14 Both repos run pnpm. Backend runtime moved Bun -> Node 22 via `@hono/node-server`. Frontend never used bun; it was npm.
- 2026-09-14 Frontend is feature-sliced (`src/features/*` + `src/shared/*`), modelled on KLTN_dev-v2/frontend and enforced by ESLint `no-restricted-imports`: features cannot import each other, shared cannot import a feature.
- 2026-09-14 (SUPERSEDED 2026-09-24 by E(i) = clamp(builtUp, 0.1, 1)) E(i) in pi(r,i) is `min(1, 0.4 + 0.1*|affected zones|)` at Stage 1. A population/building exposure term is a Stage-2 upgrade and must not be claimed before it is implemented.
- 2026-08-19 Single source of truth for PDIM Stage-1 parameters: w1=0.45, w2=0.30, w3=0.25, w4=0.15, Theta=(0.25, 0.50, 0.75), alpha=0.15, beta=0.30, gamma_w=0.05, gamma_p=0.15 per Section 4.2 of PO-UCDT manuscript.
- 2026-08-19 Multi-hazard unified spatial reference: 18 flood zones, 22 heat cells (originally named by districts — renamed 2026-09-14/24), 23 AQI reference points across HCMC.
- 2026-08-19 Rule-based recommendation engine prioritizing by pi(r, i) = S(b) * E(i) * F(a).

## Follow-ups (not bugs, not yet tasks)
- The web app is blank without `VITE_MAPBOX_TOKEN` (`apps/web/src/config/env.ts` requires it at startup), although only map/simulation need it. Make it optional and show a message on the map pages instead.
- `Alert` has no `unitId`/`unitName` (SimAlert has both); the header bell splits the §F id to find the unit. Add the fields to the alert payload (API + contracts) and drop the id parsing.
- The Mapbox basemap itself still prints former district / neighbourhood labels (e.g. "GÒ VẤP", "PHÚ NHUẬN") from Mapbox's place-label layers — our own text is clean (headless guard 2026-09-24). Hiding them means filtering those style layers; ask the user before changing the basemap.
- The heat cell list and the city AQI badge add the served uniform ΔT/ΔAQI to the served baselines in the simulators (display arithmetic on served numbers, not a model); serve per-unit values if a reviewer objects.
- `alerts` table has no CHECK on `type`/`severity` — one bad row makes `GET /v1/alerts` 500 (needs a migration).
- `POST /v1/alerts/read` returns rows actually changed; legacy returned ids sent.
- `/v1/history/{hazard}?hours=168` returns ~670 full snapshots — trim when a chart uses it.
- System alert text says "làm mới mỗi 5 phút"; the worker runs every 15. Locked by parity.json — regenerate the fixture if changed.
- `apps/web/src/router/routes.test.tsx` still encodes wave-1 placeholder headings (pages keep sr-only h1s to satisfy it).
- A real public Mapbox token lives in the legacy `Hackathon-FE/.env` (`NEXT_PUBLIC_MAPBOX_TOKEN`); copy it into `infra/.env` / `apps/web/.env.local` (both gitignored). Map layers verified with it at the W3 gate.

## Last 3 handoffs
- 2026-09-24T1540Z-claude-opus-5-77343ae4 — done: sprint S-002 (Figure 2 fidelity) closed. W1 T-101 #58, T-102 #56; W2 T-103 #60; W3 T-104 #61 + #62; W4 T-105 #63 (five-tab nav, header alert bell, served decomposition, scenario recommendations, maturity card; lead fixed web-image by copying packages/contracts); W5 T-106 draft(4).docx (§3.1 end, §4.2, Data statement). Gate on dev 24dca92: pytest 265, bun 30, web 86, headless check of every page (no administrative names, 5 tabs, bell, 3 scenario panels, maturity). B-014 closed. Lead error: draft(4).docx overwrote a pre-existing file of that name without inspecting it (see log). NEXT: author fills the Data-statement placeholders; user promotes dev → main; open B-017.
- 2026-09-23T1636Z-claude-opus-5-77343ae4 (cont. 2026-09-24) — done: wave 4 closed, sprint S-001 closed. T-012 #36 (drift check + GHCR images; first push ucdt-climate/gateway :dev, web skipped — no secret), T-013 #37 (compose.prod, deploy.sh, backup/restore, Uptime Kuma, DEPLOY.md; two review rounds: exec bits, live-DB restore). B-016 fixed (#33); flaky routes.test fixed (#35) after #33 was merged with red CI (lead error, rule added). Auto-delete branches OFF. Gate W4 green on dev 9cd795b. Map refreshed (82 nodes). NEXT: user sets the Mapbox secret, promotes dev → main, then deploys per docs/DEPLOY.md; open B-014, B-017.
- 2026-09-23T1740Z-claude-opus-5-1b6751ff (cont.) — done: wave 3 closed. T-010 full-stack compose + Caddy: 7 services healthy, all pages at http://localhost, SSE live through Caddy, legacy Hackathon-FE runs against the new stack, ≈ 213 MiB total. NEXT: user approves wave 4 (T-012 CI + GHCR, T-013 deploy/backup/docs).
