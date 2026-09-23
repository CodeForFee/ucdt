"""What-if simulation (Algorithm 2), ported from Hackathon-BE/src/services/simulation.service.ts
runSimulation and controllers/simulation.controller.ts validateScenario.
"""

import math
from datetime import datetime

from climate.pdim.constants import DRY_DAY_REFERENCE_RAIN_MM_H, PDIM_S1
from climate.pdim.flood import flood_areas
from climate.pdim.risk import effective_temp, epoch_ms, flood_risk_score, js_round


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


def run_simulation(
    scenario: dict,
    weather: dict,
    flood: dict,
    aqi: dict,
    now: datetime,
    simulation_id: str | None = None,
) -> dict:
    """SimulationResult for a validated scenario against the current weather/flood/aqi payloads.

    `simulation_id` defaults to `sim-<epoch ms>-1`; callers needing uniqueness pass their own.
    """
    rain_inc = scenario["rainfallIncrease"]
    green = scenario["addGreenCoverage"]
    rain_now = weather["current"]["rainfall"]
    soil = flood["triggers"]["soilSaturation"]
    ref = PDIM_S1["flood"]["rainRefMmH"]

    # 1. Rainfall: a dry day with a rainfall scenario scales the reference shower instead.
    base_rain = rain_now if rain_now > 0 else (DRY_DAY_REFERENCE_RAIN_MM_H if rain_inc > 0 else 0)
    new_rain = base_rain * (1 + rain_inc / 100)

    # 2. Green cover: +0.3% drainage and ΔT = −α·ΔG per +1 pp.
    new_drain = min(1, flood["triggers"]["drainageCapacity"] + green * PDIM_S1["greenToDrainPerPct"])
    temp_bonus = green * PDIM_S1["heat"]["alphaGreenDegPerPct"]

    # 3. AQI: ΔAQI = −β·ΔV − 0.15·ΔG, then γ_p washout on the rainfall the scenario ADDS.
    p_added = max(0, min(new_rain / ref, 1) - min(base_rain / ref, 1))
    aqi_linear = aqi["aqi"] - (
        scenario["trafficReduction"] * PDIM_S1["aqi"]["betaTrafficPerPct"]
        + green * PDIM_S1["aqi"]["greenPerPct"]
    )
    aqi_after = max(0, aqi_linear * (1 - PDIM_S1["aqi"]["gammaRain"] * p_added))
    aqi_delta = aqi_after - aqi["aqi"]

    before = flood["riskScore"]
    after = flood_risk_score(new_rain, soil, new_drain)
    new_areas = flood_areas(new_rain, min(soil + 0.05, 1), green, simulated=True)

    # ΔT carries both the green term and the UHI term of a changed density (B-004).
    t, h = weather["current"]["temperature"], weather["current"]["humidity"]
    base_density = PDIM_S1["heat"]["densityBaseline"]
    density = scenario.get("urbanDensity")
    if density is None:
        density = base_density
    temp_delta = (effective_temp(t, h, density) - temp_bonus) - effective_temp(t, h, base_density)

    return {
        "simulationId": simulation_id or f"sim-{epoch_ms(now)}-1",
        "status": "completed",
        "results": {
            "floodRiskDelta": js_round((after - before) * 1000) / 1000,
            "newFloodAreas": new_areas,
            "tempDelta": js_round(temp_delta * 10) / 10,
            "aqiDelta": js_round(aqi_delta * 10) / 10,
            "affectedBuildings": len(new_areas) * 1200,
            # Rough: ~80k people per high/critical area, ~50k otherwise.
            "affectedPopulation": sum(
                80000 if a["riskLevel"] in ("high", "critical") else 50000 for a in new_areas
            ),
        },
        "comparison": {
            "before": {
                "riskScore": js_round(before * 1000) / 1000,
                "affectedAreas": len(flood["affectedAreas"]),
            },
            "after": {"riskScore": js_round(after * 1000) / 1000, "affectedAreas": len(new_areas)},
        },
    }
