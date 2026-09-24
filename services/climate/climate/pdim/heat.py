"""Heat / UHI hotspots, ported from Hackathon-BE/src/services/heat.service.ts getHeatData."""

from datetime import datetime

from climate.pdim.constants import PDIM_S1
from climate.pdim.risk import effective_temp, heat_index, js_iso, js_round
from climate.spatial.units import HEAT_CELLS


def heat_risk_level(effective_temp_c: float) -> str:
    if effective_temp_c >= 44:
        return "extreme"
    if effective_temp_c >= 40:
        return "high"
    if effective_temp_c >= 37:
        return "moderate"
    return "low"


def compute_heat(weather_current: dict, now: datetime) -> dict:
    """HeatResponse from WeatherCurrent (`temperature` °C, `humidity` %)."""
    temperature = weather_current["temperature"]
    humidity = weather_current["humidity"]
    feels_like = js_round(heat_index(temperature, humidity) * 10) / 10
    hotspots = []
    for cell in HEAT_CELLS:
        eff = effective_temp(temperature, humidity, cell["urbanDensity"])
        hotspots.append(
            {
                "id": cell["id"],
                "name": cell["name"],
                "lat": cell["lat"],
                "lng": cell["lng"],
                "temperature": temperature,
                "feelsLike": feels_like,
                "effectiveTemperature": js_round(eff * 10) / 10,
                "urbanDensity": cell["urbanDensity"],
                "heatRisk": heat_risk_level(eff),
            }
        )
    city_max = max(h["effectiveTemperature"] for h in hotspots)  # HEAT_CELLS is never empty
    # Plain left-to-right sum like JS reduce (3.12's sum() is compensated and can differ in the last ulp).
    uhi_total = 0.0
    for c in HEAT_CELLS:
        uhi_total += c["urbanDensity"] * PDIM_S1["heat"]["uhiMaxDeg"]
    avg_uhi = uhi_total / len(HEAT_CELLS)
    return {
        "cityAvgTemp": temperature,
        "cityMaxEffectiveTemp": js_round(city_max * 10) / 10,
        "hotspots": hotspots,
        "uhiEffect": js_round(avg_uhi * 10) / 10,
        "timestamp": js_iso(now),
    }


def mean_effective_temp(hotspots: list[dict]) -> float:
    """City mean of the served per-cell T_eff(i) = HI(T, RH) + rho(i)·3.5 °C (manuscript §4.2).

    The heat what-if perturbs T_eff (ΔT = −α·ΔG + u·(ρ_sim − ρ₀)), so this — not the air
    temperature `cityAvgTemp` — is the baseline the simulation card adds ΔT to (B-020).
    Averages the 1-decimal values the API serves per cell, so the card and the zone list
    under it agree to the digit.
    """
    temps = [h["effectiveTemperature"] for h in hotspots]
    return js_round(sum(temps) / len(temps) * 10) / 10
