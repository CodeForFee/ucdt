"""Composite flood risk R_f(i) per zone and at city level (spec §B).

Each zone is scored from its own rainfall P(i) and the static layers of the catalogue:
P̃ = min(P/50, 1), T̃ from DEM elevation + slope, Ĩ = WorldCover builtUp, D̃ = localDrain.
"""

from collections.abc import Mapping

from climate.pdim.constants import FLOOD_REPORT_MIN_SCORE, PDIM_S1
from climate.pdim.geo import create_geojson_feature, generate_flood_polygon
from climate.pdim.risk import clamp, estimated_depth_m, flood_risk_level, js_round, rain_norm
from climate.spatial.catalogue import Catalogue, FloodZone, load_catalogue

_F = PDIM_S1["flood"]
# Signed weights, in decomposition order; drainage is the subtractive term.
WEIGHTS = {"rainfall": _F["w1"], "terrain": _F["w2"], "imperviousness": _F["w3"], "drainage": -_F["w4"]}


def _r3(x: float) -> float:
    return js_round(x * 1000) / 1000


def terrain_sensitivity(zone: FloodZone, bounds: Mapping[str, float]) -> float:
    """T̃ = ½(1 − min(z/z_ref, 1)) + ½(1 − min(s/s_ref, 1)): lower and flatter = more sensitive."""
    z = min(zone.elevation_m / bounds["elevation_m"], 1)
    s = min(zone.slope_pct / bounds["slope_pct"], 1)
    return 0.5 * (1 - z) + 0.5 * (1 - s)


def zone_terms(zone: FloodZone, rainfall: float, bounds: Mapping[str, float], add_green: float = 0) -> dict:
    """x̃ for one zone, each clamped to [0, 1]. `add_green` (pp) raises D̃ by 0.003/pp (spec §G)."""
    return {
        "rainfall": rain_norm(rainfall),
        "terrain": clamp(terrain_sensitivity(zone, bounds), 0, 1),
        "imperviousness": clamp(zone.built_up, 0, 1),
        "drainage": clamp(zone.local_drain + add_green * PDIM_S1["greenToDrainPerPct"], 0, 1),
    }


def decompose(terms: Mapping[str, float]) -> list[dict]:
    """[{key, weight, normalized, contribution}]; Σ contribution = R_f before the clamp (B-014)."""
    return [
        {"key": k, "weight": abs(w), "normalized": terms[k], "contribution": w * terms[k]}
        for k, w in WEIGHTS.items()
    ]


def score(decomposition: list[dict]) -> float:
    """R_f = clamp(Σ contribution, 0, 1) — the same left-to-right sum as risk.flood_risk_score."""
    total = 0.0
    for term in decomposition:
        total += term["contribution"]
    return clamp(total, 0, 1)


def compute_flood(
    rain_by_zone: Mapping[str, float],
    city_rainfall: float,
    cat: Catalogue | None = None,
    add_green: float = 0,
    simulated: bool = False,
) -> dict:
    """FloodResponse: per-zone R_f(i) from P(i) (mm/h, keyed by zone id) and the catalogue; the
    city level uses the city-centre rainfall with T̃, Ĩ, D̃ averaged over the 18 zones."""
    cat = cat or load_catalogue()
    bounds = cat.reference_bounds
    areas, zone_terms_all = [], []
    for zone in cat.flood_zones:
        rainfall = rain_by_zone[zone.id]
        terms = zone_terms(zone, rainfall, bounds, add_green)
        zone_terms_all.append(terms)
        dec = decompose(terms)
        r = score(dec)
        if r < FLOOD_REPORT_MIN_SCORE:
            continue
        level = flood_risk_level(r)
        props = {"name": zone.name, "riskScore": r, "riskLevel": level}
        if simulated:
            props["simulated"] = True
        areas.append(
            {
                "id": zone.id,
                "name": zone.name,
                "lat": zone.lat,
                "lng": zone.lng,
                "riskLevel": level,
                "riskScore": _r3(r),
                "estimatedDepth": estimated_depth_m(r),
                "rainfall": rainfall,
                "decomposition": dec,
                "geojson": create_geojson_feature(generate_flood_polygon(zone.lat, zone.lng, 1.2, r), props),
            }
        )

    n = len(zone_terms_all)
    city = {"rainfall": rain_norm(city_rainfall)}
    for k in ("terrain", "imperviousness", "drainage"):
        total = 0.0
        for t in zone_terms_all:
            total += t[k]
        city[k] = total / n
    city_dec = decompose(city)
    r = score(city_dec)
    return {
        "overallRisk": flood_risk_level(r),
        "riskScore": _r3(r),
        "affectedAreas": areas,
        # All four R_f terms (B-011) at city level; the legacy soil-saturation proxy is gone.
        "triggers": {
            "currentRainfall": city_rainfall,
            "terrainSensitivity": _r3(city["terrain"]),
            "imperviousness": _r3(city["imperviousness"]),
            "drainageCapacity": _r3(city["drainage"]),
        },
        "decomposition": city_dec,
    }
