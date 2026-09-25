---
id: T-106
title: manuscript: §3.1 end, §4.2 complete, Data statement → draft(4).docx
owner: claude-opus-5
scope: ../docs/PO-UCDT draft(4).docx (outside the repo), .agent/**
exit: every number/formula in §4.2 traced to spec + code in a checklist in the task file
phase: done
blocked:
created: 2026-09-24T0330Z
sprint: S-002
issue: 51
---

## Plan
Spec (all). docx skill; write a new file, never overwrite draft(2) (1).

## Execute
Built from `docs/PO-UCDT draft(2) (1).docx` (unpacked, run-merged) by a scratch script: §3.1 last
paragraph rewritten (DP1 data layer: dynamic Open-Meteo per unit / CAMS / AirGradient; static
Copernicus DEM, ESA WorldCover, OSM; Mapbox basemap only), §4.2 (i)–(iv) with Bảng 6 (parameters)
and Bảng 7 (rule base), Algorithms 1–2, maturity implementation, three properties; Data statement
(2 paragraphs with `[Tác giả xác nhận: …]` placeholders for the author); 7 references added,
Open-Meteo split into 2026a/b/c. Styles, numbering, figures and all other sections untouched
(user: the remaining sections are the author's).

**Lead error:** the first write copied over an existing `docs/PO-UCDT draft(4).docx` of unknown
origin without looking at it. No shadow copy / File History exists; the peer session was asked
for the original. Reported to the user.

## Review
Line-by-line pass of §4.2 against spec + code after T-105 landed (2026-09-24). Two sentences in
the counterfactual paragraph did not match the code and were corrected in draft(4):
- "tăng mưa đẩy một khu vực lên mức nghiêm trọng sẽ … R-FLOOD-01" — R-FLOOD-01 also needs
  P(i) > 40 mm/h (`rules.py:78`); now "… lên mức nghiêm trọng với lượng mưa vượt 40 mm/h …".
- action text "đến nơi khô ráo" — the rule says "hoặc nơi an toàn" (`rules.py`); now "đến nơi an toàn".
The UI moves (5-tab nav, alerts bell) touch no manuscript claim: §4.2 names no tab.

## Test
Checklist — draft(4) §4.2 claim → where it is true (spec § / code / live 2026-09-24 on dev 24dca92):

| claim | source |
|---|---|
| 18 zones, 22 cells, 23 points | `load_catalogue()` → 18 / 22 / 23 |
| flood→nearest AQI point, station→nearest point, commune mapping not scored | §A.3–A.4; `derive.py nearest`; `rules.py` R-COMB-01 pairing; commune never read by `pdim/*` |
| weather sampled per unit, local hour, 15 min | §A/B-012; `ingest/weather.py fetch_weather_by_unit`; worker cron 15 |
| R_f = .45P̃+.30T̃+.25Ĩ−.15D̃, clipped, Θ .25/.5/.75 | `constants.py PDIM_S1.flood`; `flood.py score` |
| P̃ = min(P/50,1) | `rainRefMmH 50`; `risk.rain_norm` |
| T̃ = ½(1−min(z/10,1)) + ½(1−min(s/2,1)), 4-point 500 m slope | §A.2; `flood.terrain_sensitivity`; `derive.stencil/slope_pct` |
| Ĩ = built-up share, 2×2 km WorldCover | §A.2; `derive.window_bounds/fractions` |
| D̃ expert constant 0,30–0,52 | recomputed: D min 0.30 max 0.52 |
| report at R_f ≥ 0,15; depth 0,8 m × R_f | `FLOOD_REPORT_MIN_SCORE`, `depthMaxM` |
| city = centre rainfall + mean T̃, Ĩ, D̃ over 18 zones | `flood.compute_flood` docstring + L96–101 |
| decomposition of 4 terms, drainage negative, sums to R_f pre-clip | `flood.decompose/score`; web renders served terms (T-105) |
| T̃ 0,08–0,97 (mean 0,59); Ĩ 0,10–0,95 (0,62) | recomputed from catalogue: (0.08, 0.97, 0.59), (0.10, 0.95, 0.62) |
| ρ₀ 0,71 (0.708), G₀ 21,8 % over 22 cells | recomputed: 0.708, 21.8 |
| T_eff = HI + 3,5ρ; bands 37/40/44 | §C; `heat.py heat_risk_level` (≥44/40/37) |
| ΔT = −0,15ΔG + 3,5(ρ_sim−ρ₀); untouched sliders → 0 | `simulation.py` L111–114; web sends ΔG vs served G₀, omits density (T-105) |
| EPA 2012 PM2.5 table; nowcast (1−γ_wW̃)(1−γ_pP̃), W̃ = wind/30, γ .05/.15 | `aqi.py`; `constants.py PDIM_S1.aqi` |
| trend ±5 % first vs last 6 h | `aqi.aqi_trend` (×1.05 / ×0.95) |
| AQI_sim = max{0,[AQI−βΔVṽ−κΔG](1−γ_pΔP̃)}, β .3, κ .15, ṽ = v/v̄, 1 km roads | `simulation.py aqi_sim`; §A.3 road density |
| P_sim = P(1+r/100), 20 mm/h dry-day shower; D̃_sim = min(1, D̃+0,003ΔG) | `DRY_DAY_REFERENCE_RAIN_MM_H`; `flood.zone_terms` (clamp) |
| bounds rain 0–500, green ±100, traffic 0–100, density 0–1 | `simulation._BOUNDS`, `validate_scenario` |
| 9 rules, conditions, S(b), F(a) of Bảng 7; R-COMB-01 R_f>.5 & AQI>150 | `rules.py` L78–241 |
| π = S·E·F, E = min{1, max[0,1; ρ]}, rounded 2 dp | `rules.py` L52, L61 |
| rank by π, tie rule id then toponym, k = 10, firedCount | `rules.py` L256; `RECOMMEND_TOP_K` |
| each item: rule id, toponym, π, inputs incl. E and F | `inputs {…, exposureE, feasibilityFa}`; `RecommendList` "Vì sao" |
| R-NORM-00 π = 0 when none fires | `rules.py` L275 |
| R-FLOOD-01 action list | `rules.py` L90–95 |
| alerts on band rise vs previous snapshot; flood .5/.75, storm 30/50, AQI 150/200, heat 37/40; expiry 1–6 h; id hazard/unit/band/local hour | `rules.ALERT_BANDS`, `band_alerts` |
| counterfactual re-runs steps 3, 5, 6; recs + band changes + would-fire alerts, not stored | `run_counterfactual`; live POST rain +500 %: firedCount 17, top R-FLOOD-01 at P 120, 34 alerts, 17 flood band changes |
| every simulator shows the scenario recommendations | headless 2026-09-24: all 3 simulators render "Khuyến nghị cho kịch bản" |
| Algorithm 1: W 14 d, δ 2, ≥168 pairs over ≥7 d, 70/30, t-quantile CI, S3 12 months, stateless demotion | `maturity.py` L18–23, `evaluate` |
| flood/heat D(S2) false with reason shown | `maturity._no_s2`; MaturityCard renders `stage.reason` |
| stage, criteria, MAE, S2 CIs on the dashboard (line 8) | headless: 3 maturity rows on /dashboard |
| one open station in HCMC, all three hazards S1 | live `/api/aqi` observedStations 1; `/api/maturity` active S1 ×3 |
| snapshot stores inputs, result, model version | `snapshots.store_run` |

`validate.py draft(4) --original draft(2) (1)` → All validations PASSED (paragraphs 260 → 408).

## Handoff
Done. The author fills the Data-statement placeholders. The previous draft(4) build is kept at
the session scratchpad (`draft4_v1_backup.docx`).
