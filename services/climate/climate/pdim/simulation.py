"""What-if simulation (Algorithm 2 step 7): `run_counterfactual` re-runs steps 3–6 on the
counterfactual state (spec §G). `validate_scenario` is ported from Hackathon-BE
controllers/simulation.controller.ts.
"""

import math
from datetime import datetime

from climate.pdim import flood as flood_mod
from climate.pdim.constants import DRY_DAY_REFERENCE_RAIN_MM_H, PDIM_S1, get_aqi_level
from climate.pdim.heat import heat_risk_level
from climate.pdim.risk import (
    epoch_ms,
    flood_risk_level,
    js_round,
    rain_norm,
)
from climate.pdim.rules import band_alerts, recommendations, unit_values
from climate.spatial.catalogue import Catalogue, load_catalogue


def _finite(v) -> bool:
    """`Number.isFinite`: a real number, not bool/str/None/NaN/inf."""
    return isinstance(v, int | float) and not isinstance(v, bool) and math.isfinite(v)


# (field, lo, hi, message) — every lever the PDIM response functions consume is bounded.
_BOUNDS = (
    ("rainfallIncrease", 0, 500, "rainfallIncrease must be 0-500"),
    ("rainfallDurationHours", 0, 72, "rainfallDurationHours must be 0-72"),
    (
        "addGreenCoverage",
        -100,
        100,
        "addGreenCoverage must be -100..100 (percentage points relative to baseline)",
    ),
    ("trafficReduction", 0, 100, "trafficReduction must be 0-100"),
)


def validate_scenario(s: dict) -> str | None:
    """Trust-boundary check. Returns an error message, or None when acceptable.

    `urbanDensity` may be absent or None (scored at the baseline density).
    """
    for field, lo, hi, msg in _BOUNDS:
        v = s.get(field)
        if not _finite(v) or v < lo or v > hi:
            return msg
    d = s.get("urbanDensity")
    if d is not None and (not _finite(d) or d < 0 or d > 1):
        return "urbanDensity must be 0-1"
    return None


# ── §G counterfactual ────────────────────────────────────────────────────────
def _r1(x: float) -> float:
    return js_round(x * 10) / 10


def _band_changes(before: dict, after: dict, units, level) -> list[dict]:
    out = []
    for u in units:
        b, a = before.get(u.id), after.get(u.id)
        if b is None and a is None:
            continue
        b, a = level(b), level(a)
        if b != a:
            out.append({"unitId": u.id, "name": u.name, "before": b, "after": a})
    return out


def run_counterfactual(
    scenario: dict,
    snapshots: dict,
    now: datetime,
    cat: Catalogue | None = None,
    simulation_id: str | None = None,
) -> dict:
    """SimulationResult for a validated scenario against the latest flood/heat/aqi snapshots
    (`{hazard: {"inputs": ..., "result": ...}}`, as repo.latest_snapshot returns them).

    Counterfactual state: P_sim(i) = P_base(i)·(1 + r/100) (P_base = the 20 mm/h reference shower
    when P(i) = 0 and r > 0); D̃_sim(i) = min(1, D̃(i) + 0.003·ΔG); T_eff,sim(i) = T_eff(i) + ΔT with
    ΔT = −α·ΔG + u·(ρ_sim − ρ₀); AQI_sim(i) = max(0, (AQI(i) − β·ΔV·ṽ(i) − κ·ΔG)·(1 − γ_p·P̃_added)).
    Then step 3 (scores, bands), step 5 (alerts that WOULD fire, never persisted) and step 6
    (ℛ, π, top-k) run on that state."""
    cat = cat or load_catalogue()
    fl_in, fl = snapshots["flood"]["inputs"], snapshots["flood"]["result"]
    heat = snapshots["heat"]["result"]
    aq_in, aq = snapshots["aqi"]["inputs"], snapshots["aqi"]["result"]
    r, dg, dv = scenario["rainfallIncrease"], scenario["addGreenCoverage"], scenario["trafficReduction"]
    p_aqi, p_heat = PDIM_S1["aqi"], PDIM_S1["heat"]

    def base_rain(p: float) -> float:
        return p if p > 0 else (DRY_DAY_REFERENCE_RAIN_MM_H if r > 0 else 0)

    def sim_rain(p: float) -> float:
        return base_rain(p) * (1 + r / 100)

    # Flood (§B on the counterfactual state).
    fl_sim = flood_mod.compute_flood(
        {z: sim_rain(p) for z, p in fl_in["rainfall"].items()},
        sim_rain(fl_in["cityRainfall"]),
        cat,
        add_green=dg,
        simulated=True,
    )

    # Heat (§C): the served ρ₀ is the reference, so an untouched density slider gives 0.
    rho0 = heat["baselines"]["density"]
    rho = scenario.get("urbanDensity")
    rho = rho0 if rho is None else rho
    temp_delta = -p_heat["alphaGreenDegPerPct"] * dg + p_heat["uhiMaxDeg"] * (rho - rho0)
    heat_sim = {h["id"]: _r1(h["temperature"] + temp_delta) for h in heat["hotspots"]}

    # AQI (§D): ṽ(i) = v(i)/mean(v); the city uses ṽ = 1.
    v_mean = sum(p.road_density for p in cat.aqi_points) / len(cat.aqi_points)
    v_tilde = {p.id: p.road_density / v_mean for p in cat.aqi_points}

    def aqi_sim(a: float, vt: float, rain: float) -> float:
        added = max(0, rain_norm(sim_rain(rain)) - rain_norm(base_rain(rain)))
        linear = a - (dv * p_aqi["betaTrafficPerPct"] * vt + dg * p_aqi["greenPerPct"])
        return max(0, linear * (1 - p_aqi["gammaRain"] * added))

    weather = aq_in["pointWeather"]
    stations = []
    for s in aq["stations"]:
        after = js_round(aqi_sim(s["aqi"], v_tilde[s["id"]], weather[s["id"]]["rainfall"]))
        stations.append(
            {"id": s["id"], "name": s["name"], "before": s["aqi"], "after": after, "delta": after - s["aqi"]}
        )
    city_aqi_after = aqi_sim(aq["aqi"], 1, weather["city"]["rainfall"])

    # Steps 5–6 on the counterfactual state, against the current one.
    now_values = unit_values(fl, aq, heat)
    sim_values = unit_values(
        fl_sim, {"stations": [{"id": s["id"], "aqi": s["after"]} for s in stations]}, None
    )
    sim_values["heat"] = heat_sim
    rec = recommendations(sim_values, cat, now)

    def flood_level(v):
        return flood_risk_level(v["riskScore"] if v else 0)

    before, after = fl["riskScore"], fl_sim["riskScore"]
    return {
        "simulationId": simulation_id or f"sim-{epoch_ms(now)}-1",
        "status": "completed",
        "results": {
            "floodRiskDelta": js_round((after - before) * 1000) / 1000,
            "newFloodAreas": fl_sim["affectedAreas"],
            "tempDelta": _r1(temp_delta),
            "aqiDelta": _r1(city_aqi_after - aq["aqi"]),
            "stations": stations,
        },
        "comparison": {
            "before": {"riskScore": before, "affectedAreas": len(fl["affectedAreas"])},
            "after": {"riskScore": after, "affectedAreas": len(fl_sim["affectedAreas"])},
        },
        "counterfactual": {
            "recommendations": rec["recommendations"],
            "firedCount": rec["firedCount"],
            "alerts": band_alerts(sim_values, now_values, cat, now),
            "bandChanges": {
                "flood": _band_changes(
                    now_values["flood"], sim_values["flood"], cat.flood_zones, flood_level
                ),
                "heat": _band_changes(
                    now_values["heat"], sim_values["heat"], cat.heat_cells, lambda t: heat_risk_level(t or 0)
                ),
                "aqi": _band_changes(
                    now_values["aqi"], sim_values["aqi"], cat.aqi_points, lambda a: get_aqi_level(a or 0)
                ),
            },
        },
    }
