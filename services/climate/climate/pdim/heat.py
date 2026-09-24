"""Heat / UHI per cell (spec §C): T_eff(i) = HI_Rothfusz(T(i), RH(i)) + 3.5 °C·ρ(i), ρ(i) = builtUp(i).

Returns the served payload directly (legacy heatController's reshape of getHeatData, plus the
what-if baselines ρ₀ and G₀)."""

from collections.abc import Mapping
from datetime import datetime

from climate.pdim.constants import PDIM_S1
from climate.pdim.risk import effective_temp, js_iso, js_round
from climate.spatial.catalogue import Catalogue, load_catalogue


def _r1(x: float) -> float:
    return js_round(x * 10) / 10


def heat_risk_level(effective_temp_c: float) -> str:
    if effective_temp_c >= 44:
        return "extreme"
    if effective_temp_c >= 40:
        return "high"
    if effective_temp_c >= 37:
        return "moderate"
    return "low"


def heat_baselines(cat: Catalogue) -> dict:
    """ρ₀ = mean builtUp (0–1, 3 dp) and G₀ = mean green (percent, 1 dp) over the 22 cells.

    The what-if measures ΔT against exactly these served values, so sliders that start at them
    give ΔT = 0."""
    return {
        "density": js_round(cat.mean_built_up_heat * 1000) / 1000,
        "greenPct": _r1(cat.mean_green_heat * 100),
    }


def mean_effective_temp(temps: list[float]) -> float:
    """City mean of the served per-cell T_eff(i) (1-dp values), 1 dp — the heat what-if baseline
    (B-020), so the card and the zone list under it agree to the digit."""
    return _r1(sum(temps) / len(temps))


def compute_heat(
    weather_by_cell: Mapping[str, dict],
    city_current: dict,
    now: datetime,
    cat: Catalogue | None = None,
    city: str = "hcmc",
) -> dict:
    """HeatResponse from each cell's own WeatherCurrent (`temperature` °C, `humidity` %)."""
    cat = cat or load_catalogue()
    uhi = PDIM_S1["heat"]["uhiMaxDeg"]
    hotspots = []
    uhi_total = 0.0  # plain left-to-right sum like JS reduce
    for cell in cat.heat_cells:
        w = weather_by_cell[cell.id]
        eff = effective_temp(w["temperature"], w["humidity"], cell.built_up)
        uhi_total += cell.built_up * uhi
        hotspots.append(
            {
                "id": cell.id,
                "name": cell.name,
                "lat": cell.lat,
                "lng": cell.lng,
                "temperature": _r1(eff),
                "intensity": cell.built_up,
            }
        )
    temps = [h["temperature"] for h in hotspots]
    return {
        "city": city,
        "timestamp": js_iso(now),
        "avgTemperature": city_current["temperature"],  # city-centre AIR temperature
        "maxTemperature": _r1(max(temps)),
        "heatIslandIntensity": _r1(uhi_total / len(hotspots)),
        "avgEffectiveTemperature": mean_effective_temp(temps),
        "baselines": heat_baselines(cat),
        "hotspots": hotspots,
        "geojson": {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "geometry": {"type": "Point", "coordinates": [h["lng"], h["lat"]]},
                    "properties": {"temperature": h["temperature"], "intensity": h["intensity"]},
                }
                for h in hotspots
            ],
        },
    }
