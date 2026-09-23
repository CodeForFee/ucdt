# Board — Urban Climate Digital Twin (PO-UCDT)

## Roster
| provider | can | cost | use for |
|---|---|---|---|
| antigravity | repo-wide, shell, code, full-stack | high | architecture, multi-file refactor, verification |
| cursor / codex | open files, inline edits | low | single-file edits, stubs |
| commands | pnpm test, pnpm typecheck, pnpm build, pnpm lint | free | mechanical correctness gates |
| claude subagents (Agent tool) | repo, shell, git worktree, gh | opus = strong, sonnet = cheap | sprint seams; each on its own branch + PR |

## Now (claims)
- whole repo — claude-opus-5 (tech lead, sprint S-001), since 2026-09-23T1617Z. Only the tech lead edits this board; seam owners edit only their task scope, their task file and their own log.

**Git flow (user decision 2026-09-23):** one GitHub issue per task → branch `feat/T-NNN-<slug>` → PR **into `dev`** → tech lead reviews + squash-merges into `dev`, then closes the issue. **`main` belongs to the user** — agents never push or merge to main. `.agent/` lives in the repo (moved from the workspace root 2026-09-23); seam owners commit their task file + log inside their own PR, the lead commits board updates in the wave-gate PR.

**Lost:** the three legacy logs (2026-08-19T0900Z-antigravity, 2026-09-14T0730Z/0750Z-claude-opus-5) vanished from the old workspace-root `.agent/log/` during this session before the move — not deleted by any command run here, not in the Recycle Bin. Their substance survives in Bugs, Decisions and handoffs below.

## Tasks (S-001 · UCDT v2 monorepo — `.agent/sprints/S-001.md`)
| id | issue | title | wave | owner | phase |
|---|---|---|---|---|---|
| T-001 | #2 | scaffold + interfaces | 0 | claude-opus-5 | done |
| T-002 | #3 | PDIM logic port (Python) | 1 | claude-opus-5 (sub) | plan |
| T-003 | #4 | DB schema + repo | 1 | claude-opus-5 (sub) | plan |
| T-004 | #5 | gateway (Bun + Hono) | 1 | claude-sonnet-5 (sub) | plan |
| T-005 | #6 | web shell + shared | 1 | claude-sonnet-5 (sub) | plan |
| T-011 | #7 | godkit-map for ucdt/ | 1-gate | claude-opus-5 | plan |
| T-006 | #8 | ingest + worker | 2 | claude-opus-5 (sub) | plan |
| T-007 | #9 | climate-api + contracts | 2 | claude-opus-5 (sub) | plan |
| T-008 | #10 | web: dashboard, flood, air-quality, alerts | 2 | claude-sonnet-5 (sub) | plan |
| T-009 | #11 | web: map + simulation | 2 | claude-sonnet-5 (sub) | plan |
| T-010 | #12 | full-stack compose + Caddy | 3 | claude-opus-5 | plan |
| T-012 | #13 | CI complete + GHCR | 4 | claude-sonnet-5 (sub) | plan |
| T-013 | #14 | deploy + backup + DEPLOY.md | 4 | claude-sonnet-5 (sub) | plan |

**Chờ người dùng:** `docs/PO-UCDT draft(3).docx` đang mở trong Word nên không ghi đè được. Bản đã sửa (3 câu §4.3/§4.4.2 cho khớp prototype sau khi bỏ tab + phân giải R_f 4 số hạng) nằm ở `docs/.draft3.tmp.docx`. Đóng Word rồi `mv .draft3.tmp.docx "PO-UCDT draft(3).docx"`.

## Bugs
- [ ] B-012 `Hackathon-BE/src/utils/dataTransformer.ts` `transformOpenMeteoResponse` finds the "current hour" by matching `now.toISOString()` (UTC) against Open-Meteo `hourly.time`, which is requested in `Asia/Ho_Chi_Minh` local time — so "current" weather and the 24 h forecast start 7 h in the past (falls back to index 0 before 07:00 local). Found 2026-09-23 claude-opus-5 while planning S-001. Legacy repo is frozen; fix lands in ucdt T-006 (match on HCMC local hour) with a test.
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
- 2026-09-14 Nav carries four tabs: Dashboard, Map, Simulation, Flood. Air-quality and alerts are represented by dashboard cards; their detail pages stay reachable by URL. §4.3/§4.4.2 of the manuscript were reworded to match — do not reinstate the "first-class nav tab" claim without also changing the nav.
- 2026-09-14 Any UI that claims to decompose a composite score must show EVERY term with its weight, sum them, and render subtractive terms in the opposite direction. A partial decomposition is worse than none: it invites a reader to add up numbers that cannot reproduce the score.
- 2026-09-14 Spatial units are named by coordinate-anchored TOPONYMS, never by administrative units. Resolution 1685/NQ-UBTVQH15 (2025) abolished the district tier in HCMC (168 commune-level units). `id` fields keep their historic slugs as internal keys only. Guarded by tests/spatialNaming.test.ts and an API-surface assertion.
- 2026-09-14 DP3 is enforced architecturally, not by convention: every coefficient lives in ONE constants module per repo, cross-checked by tests on both sides; the presentation layer must never compute a substitute for a value the processing layer owns.
- 2026-09-14 Both repos run pnpm. Backend runtime moved Bun -> Node 22 via `@hono/node-server`. Frontend never used bun; it was npm.
- 2026-09-14 Frontend is feature-sliced (`src/features/*` + `src/shared/*`), modelled on KLTN_dev-v2/frontend and enforced by ESLint `no-restricted-imports`: features cannot import each other, shared cannot import a feature.
- 2026-09-14 E(i) in pi(r,i) is `min(1, 0.4 + 0.1*|affected zones|)` at Stage 1. A population/building exposure term is a Stage-2 upgrade and must not be claimed before it is implemented.
- 2026-08-19 Single source of truth for PDIM Stage-1 parameters: w1=0.45, w2=0.30, w3=0.25, w4=0.15, Theta=(0.25, 0.50, 0.75), alpha=0.15, beta=0.30, gamma_w=0.05, gamma_p=0.15 per Section 4.2 of PO-UCDT manuscript.
- 2026-08-19 Multi-hazard unified spatial reference: 18 flood zones, 22 districts, 23 AQI monitoring stations across HCMC.
- 2026-08-19 Rule-based recommendation engine prioritizing by pi(r, i) = S(b) * E(i) * F(a).

## Last 3 handoffs
- 2026-09-23T1617Z-claude-opus-5 — partial: opened sprint S-001 (UCDT v2 monorepo `ucdt/`, github CodeForFee/ucdt private); T-001 done (scaffold, deps, PDIM constants + 63 units, parity fixture 695+11, compose postgis+redis, CI 3/3 green). Found B-012. Branch protection unavailable (private Free). NEXT: wave 1 T-002..T-005 after user approval.
- 2026-09-14T0750Z-claude-opus-5 — done: dropped air-quality + alerts nav tabs; fixed flood page (false data source, misleading trigger chart, missing terrain term) with a 4-term R_f decomposition verified against live API; manuscript corrected. PENDING: draft(3).docx locked by Word, corrected copy at docs/.draft3.tmp.docx.
- 2026-09-14T0730Z-claude-opus-5 — done: manuscript<->prototype alignment; 63 spatial units renamed off administrative labels; fixed the processing-layer urbanDensity drop and the presentation-layer recommendation panel; FE feature-sliced refactor + 1.3k lines of dead code deleted; both repos on pnpm; docs/PO-UCDT draft(3).docx written with all 8 empty sections filled.
