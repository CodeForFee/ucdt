# S-002 spec — Figure 2 fidelity (single source for the code AND manuscript §4.2)

Every formula, input and payload below is normative. Seams implement exactly this; the lead
writes §4.2, the end of §3.1 and the Data statement of `docs/PO-UCDT draft(4).docx` from this
file. A change to the model changes this file first.

Figure 2 box → section: Data layer {weather API → §I.1, open AQ monitoring network → §I.3,
DEM & land cover (Landsat/Sentinel) → §A.2, administrative boundaries & traffic proxy → §A.3};
Processing layer {spatio-temporal harmonisation → §B, R_f = Σwᵢx̃ᵢ → Θ → §B, response
functions & nowcast ΔT = −α·ΔG · ΔAQI = −β·ΔV → §C–§D, rule base ℛ + π(r, i) → §E};
Presentation {real-time dashboard, multi-layer 2D/3D map, what-if (flood·heat·AQI), ranked
alerts & recommendations → §F, §G, §J}; Maturity axis S1→S2→S3 via Algorithm 1 → §H.

## A. Spatial units, static layers, mapping tables

### A.1 Units and names
18 flood zones, 22 heat cells, 23 AQI points (`climate/spatial/units.py`), named by
coordinate-anchored TOPONYMS. No display name may be an administrative label: not "Quận",
"Huyện", "Q.", "District", and not a former district name. The 11 heat cells that still carry
former district names are renamed to the toponym of the AQI point at the same coordinates:

| id | new name | | id | new name |
|---|---|---|---|---|
| binhthanh | Đinh Bộ Lĩnh | | thuduc | Linh Trung |
| phunhuan | Phan Xích Long | | binhchanh | Nguyễn Văn Linh |
| tanbinh | Lê Văn Sỹ | | hocmon | Quang Trung |
| tanphu | Lũy Bán Bích | | nhabe | Phước Kiển |
| govap | Nguyễn Oanh | | cangio | Cần Thạnh |
| binhtan | An Lạc | | cuchi | Tây Bắc |

Guard: a test fails if any unit name, or any name in any API payload, matches
`/\b(Quận|Huyện|District)\b|\bQ\.\s?\d/` or one of: Bình Thạnh, Phú Nhuận, Tân Bình, Tân Phú,
Gò Vấp, Bình Tân, Thủ Đức, Bình Chánh, Hóc Môn, Nhà Bè, Cần Giờ, Củ Chi.

### A.2 DEM and land cover (static, derived once, committed with provenance)
`python -m climate.spatial.derive` (needs network + the `derive` dependency group) writes
`climate/spatial/derived.json`; runtime and CI read only the committed file.

- **Elevation** z(i) [m]: Copernicus DEM GLO-90 via the Open-Meteo Elevation API at the unit
  coordinate.
- **Slope** s(i) [%]: from the same API on a 3×3 stencil at 500 m spacing centred on the unit;
  s = 100·max(|z_E − z_W|, |z_N − z_S|)/1000 (central differences over 1 km).
- **Land cover** (ESA WorldCover 2021 v200, 10 m, derived from Sentinel-1/2): class fractions in
  a 2 km × 2 km window centred on the unit. builtUp = class 50; green = classes
  10, 20, 30, 90, 95 (tree, shrub, grassland, herbaceous wetland, mangroves); water = 80.

### A.3 Administrative boundaries and traffic proxy (static, OSM, ODbL)
- **Commune** (2025 commune-level unit containing the point, admin_level 6 after Resolution
  1685/NQ-UBTVQH15): name + OSM relation id. Context only (shown as secondary text, e.g.
  "Bến Nghé · Phường Sài Gòn"); never a unit name, never used for scoring.
- **Road density** v(i) [km/km²]: total length of OSM ways with highway ∈ {motorway, trunk,
  primary, secondary} within 1 km of the unit, divided by π·1² km². Computed for AQI points.

### A.4 Mapping tables (in derived.json)
- flood zone → nearest AQI point (haversine) — pairs the two supports for R-COMB-01.
- open-network station → nearest AQI point — pairs observations with the CAMS estimate for §H.
Supports are linked only through these tables; they are never read as one homogeneous grid.

## B. Spatio-temporal harmonisation and composite flood risk

Temporal: every run (worker, every 15 min) aligns each Open-Meteo series to the current
Asia/Ho_Chi_Minh local hour (B-012) and scores one snapshot; all outputs carry `observedAt`.
Spatial: each unit is scored from the weather sampled at its own coordinate (§I.1).

Normalisation with fixed reference bounds (set once per deployment, stored in derived.json):
- P̃(i) = min(P(i)/50, 1), P in mm/h (extreme-rain reference 50 mm/h).
- T̃(i) = ½·(1 − min(z(i)/10, 1)) + ½·(1 − min(s(i)/2, 1)) — lower and flatter = more
  sensitive; reference bounds 10 m elevation and 2 % slope.
- Ĩ(i) = builtUp(i) — imperviousness from WorldCover.
- D̃(i) = localDrain(i) — drainage capacity. No open drainage dataset exists for HCMC, so this
  stays an expert-judgement constant, stated as such (DP3).

R_f(i) = w₁·P̃(i) + w₂·T̃(i) + w₃·Ĩ(i) − w₄·D̃(i), clamped to [0, 1]; w = (0.45, 0.30, 0.25,
0.15), Σw over the additive terms = 1. Bands Θ = (0.25, 0.50, 0.75) → low / medium / high /
critical. A zone is reported when R_f(i) ≥ 0.15. Screening depth = R_f(i) × 0.8 m.
City level: P̃ from the city-centre rainfall; T̃, Ĩ, D̃ = means over the 18 zones.
`triggers` carries all four terms (B-011) under keys currentRainfall, terrainSensitivity,
imperviousness, drainageCapacity (the legacy soil-saturation proxy is removed).

## C. Heat
Per cell i: T(i), RH(i) from the unit's own weather; ρ(i) = builtUp(i) (replaces the
expert urbanDensity). T_eff(i) = HI_Rothfusz(T(i), RH(i)) + 3.5 °C·ρ(i). Bands on T_eff: 37 / 40
/ 44 °C (moderate / high / extreme).
Baselines served in the heat payload: ρ₀ = mean ρ(i) over the 22 cells; G₀ = mean green(i).
What-if: ΔT = −α·ΔG + u·(ρ_sim − ρ₀), α = 0.15 °C per pp green, u = 3.5 °C; ΔG = G_sim − G₀
in percentage points. T_eff,sim(i) = T_eff(i) + ΔT. The sliders start at ρ₀ and G₀.
City payload: avgTemperature = city-centre air temperature (dashboard), maxTemperature = max
T_eff(i), heatIslandIntensity = mean 3.5·ρ(i), avgEffectiveTemperature = mean T_eff(i) (B-020).

## D. Air quality
Per AQI point i: CAMS PM2.5 (Open-Meteo Air Quality) → US AQI (EPA 2012 breakpoints).
City: same at the centre; 24 h nowcast AQI(t+1) = AQI(t)·(1 − γ_w·W̃)·(1 − γ_p·P̃), γ_w = 0.05,
γ_p = 0.15, W̃ = min(wind/30 km/h, 1); trend = ±5 % between first and last 6 h means.
Open-network stations (§I.3) are served separately as `observedStations` and feed §H.
What-if per point: AQI_sim(i) = max(0, (AQI(i) − β·ΔV·ṽ(i) − κ·ΔG)·(1 − γ_p·P̃_added)),
β = 0.3 per % traffic reduction, κ = 0.15 per pp green, ṽ(i) = v(i)/mean(v) (mean ṽ = 1),
P̃_added = max(0, P̃_sim − P̃_base). City-level ΔAQI uses ṽ = 1, i.e. ΔAQI = −β·ΔV − κ·ΔG before
washout — Figure 2's ΔAQI = −β·ΔV.

## E. Rule base ℛ and ranking π(r, i)
Rules fire PER UNIT on that unit's own band:
| rule | unit kind | fires when | S(b) | F(a) |
|---|---|---|---|---|
| R-FLOOD-01 | flood zone | R_f(i) > 0.75 and P(i) > 40 mm/h | 4 | 0.90 |
| R-FLOOD-02 | flood zone | else R_f(i) > 0.50 | 3 | 0.85 |
| R-FLOOD-03 | flood zone | else R_f(i) > 0.25 | 2 | 0.80 |
| R-AQI-01 | AQI point | AQI(i) > 200 | 4 | 0.95 |
| R-AQI-02 | AQI point | else AQI(i) > 150 | 3 | 0.90 |
| R-AQI-03 | AQI point | else AQI(i) > 100 | 2 | 0.85 |
| R-HEAT-01 | heat cell | T_eff(i) > 40 °C | 4 | 0.85 |
| R-HEAT-02 | heat cell | else T_eff(i) > 37 °C | 3 | 0.80 |
| R-COMB-01 | flood zone | R_f(i) > 0.50 and AQI(m(i)) > 150, m = nearest AQI point (§A.4) | 4 | 0.95 |
Priority: S(b) 4/3/2 → urgent/high/medium (uniform, B-008). Exposure E(i) = clamp(builtUp(i),
0.1, 1) — built-up share as a building-exposure proxy (NOT population; population exposure
remains Stage 2). π(r, i) = S(b)·E(i)·F(a), 2 decimals. All fired (r, i) are ranked by π desc
(ties: ruleId, then unit name); the top k = 10 are returned with `firedCount` = total fired.
Each item: id `<ruleId>:<unitId>`, ruleId, unitId, unitName, unitKind, commune, priorityScore,
priority, category, title, message (names the unit and its value), actionItems, timestamp,
inputs {the unit's value(s), severityBand, exposureE, feasibilityFa}. If nothing fires:
the default-state message R-NORM-00 with π = 0 (not a member of ℛ). No generative text.

## F. Alerts (Algorithm 2 step 5: band change or threshold crossing, per unit)
Each run compares every unit's band with its band in the previous snapshot (missing → low)
and emits an alert when the band RISES into an alerting band:
flood R_f(i) > 0.50 (warning) / > 0.75 (critical); AQI(i) > 150 / > 200; T_eff(i) > 37 / > 40;
rainfall threshold crossing P(i) > 30 / > 50 mm/h (storm, per zone). id
`<hazard>:<unitId>:<band>:<YYYY-MM-DDTHH local>`, ON CONFLICT DO NOTHING. Expiry: flood 3 h
(critical 2 h), AQI 6 h (critical 4 h), heat 6 h, storm 1 h. The legacy always-on "system"
info alert is dropped. Active alerts are served newest first; severity critical > warning.

## G. What-if (Algorithm 2 step 7: re-run steps 3–6 on the counterfactual state)
Counterfactual inputs: P_sim(i) = P_base(i)·(1 + r/100) where P_base(i) = P(i), or the 20 mm/h
dry-day reference shower when P(i) = 0 and r > 0; D̃_sim(i) = min(1, D̃(i) + 0.003·ΔG);
T̃, Ĩ unchanged; T_eff,sim(i) = T_eff(i) + ΔT; AQI_sim(i) per §D. Then step 3 (score + bands),
step 5 (alerts that WOULD fire: b_sim > b_now; returned, never persisted) and step 6 (ℛ, π,
top-k) run on that state. Response keeps floodRiskDelta, newFloodAreas, tempDelta, aqiDelta,
comparison{before, after}; adds `stations` [{id, name, before, after, delta}] and
`counterfactual` {recommendations (same shape as §E), alerts [...], bandChanges {flood, heat,
aqi: [{unitId, name, before, after}]}}. The legacy affectedBuildings / affectedPopulation
heuristics are removed (B-016).

## H. Algorithm 1 — model maturity per hazard
active(h) = S1 for every h unless promoted. Evaluated on every `/v1/maturity` request from
stored history (line 9), window W = 14 days, advancement margin δ = 2 AQI points.
- D(S2, flood): needs an observed inundation / gauge series — none in the data layer → false.
- D(S2, heat): needs observed air/land-surface temperature at the cells (Landsat LST ingestion
  is Stage 2) → false.
- D(S2, aqi): ≥ 168 paired hourly observations (open-network station AQI vs the CAMS AQI at
  its mapped point, §A.4) spanning ≥ 7 days within W. If true: fit S2 = least-squares
  bias correction AQI_obs ≈ a + b·AQI_CAMS on the earliest 70 % of pairs; promote when
  MAE_holdout(S2) ≤ MAE_holdout(S1) − δ on the latest 30 %. While S2 is active, AQI points are
  served as a + b·AQI_CAMS and snapshots carry model_version `pdim-s2-aqi`; demote when the
  condition fails at a later evaluation.
- D(S3, h): ≥ 12 months of archived data → false in this deployment.
Line 8 (exposure): `/v1/maturity` returns per hazard: active stage, stage criteria with
counts vs requirements, S1 validation MAE against stations where pairs exist (null otherwise),
S2 parameters and MAE when fitted, evaluatedAt.

## I. Data layer ingestion (worker, every 15 min)
1. **Weather**: one Open-Meteo Forecast request for the unique coordinates of all units + the
   city centre (current + hourly), hour-aligned per §B.
2. **Air quality (gridded)**: Open-Meteo Air Quality (CAMS) at the 23 points + centre; IQAir /
   AQICN only as optional fallbacks when their keys are set.
3. **Open monitoring network**: AirGradient public API (no key), every location inside the
   HCMC bbox lat 10.3–11.2, lng 106.3–107.1; PM2.5 (`pm02`, µg/m³) → US AQI; stored in aqi_obs
   with location_id `ag:<locationId>`, source `airgradient`.
Static layers (§A) are not fetched at runtime.

## J. Presentation
- Dashboard: ranked recommendations list (rule, unit, commune, π, inputs); per-unit alerts;
  maturity card (stage per hazard, S2 criteria progress, validation MAE); data provenance.
- Map: AQI layer adds open-network station markers (distinct style, "trạm quan trắc").
- Each simulator (flood, heat, AQI): after a run, a "Khuyến nghị cho kịch bản" panel with the
  counterfactual top-k, band changes and would-fire alerts; AQI shows per-station before/after.
- Flood decomposition labels: T̃ "độ nhạy địa hình (DEM)", Ĩ "độ không thấm (Sentinel)".
- Heat sliders start at the served ρ₀ and G₀.
- Popups show "toponym · commune"; never a district label.
