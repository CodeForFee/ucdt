"""City + per-zone flood risk, ported from Hackathon-BE/src/external/googleFlood.client.ts.

computeFloodData never called Google: R_f is computed locally from rainfall (B-009).
"""

from climate.pdim.constants import PDIM_S1
from climate.pdim.geo import create_geojson_feature, generate_flood_polygon
from climate.pdim.risk import estimated_depth_m, flood_risk_level, flood_risk_score, js_round
from climate.spatial.units import FLOOD_ZONES

# Zones scoring below this are not reported as affected.
_MIN_ZONE_SCORE = 0.15


def flood_areas(
    rainfall: float, local_soil: float, add_green_pct: float = 0, simulated: bool = False
) -> list:
    """Score all 18 zones; shared by the baseline and the what-if so both use one grid."""
    areas = []
    for zone in FLOOD_ZONES:
        drain = min(1, zone["localDrain"] + add_green_pct * PDIM_S1["greenToDrainPerPct"])
        score = flood_risk_score(rainfall, local_soil, drain, zone["terrain"])
        if score < _MIN_ZONE_SCORE:
            continue
        level = flood_risk_level(score)
        props = {"name": zone["name"], "riskScore": score, "riskLevel": level}
        if simulated:
            props["simulated"] = True
        areas.append(
            {
                "id": zone["id"],
                "name": zone["name"],
                "lat": zone["lat"],
                "lng": zone["lng"],
                "riskLevel": level,
                "riskScore": js_round(score * 1000) / 1000,
                "estimatedDepth": estimated_depth_m(score),
                "geojson": create_geojson_feature(
                    generate_flood_polygon(zone["lat"], zone["lng"], 1.2, score), props
                ),
            }
        )
    return areas


def compute_flood(
    rainfall: float,
    month: int,
    soil_saturation: float | None = None,
    drainage_capacity: float | None = None,
) -> dict:
    """FloodResponse for a rainfall intensity (mm/h). `month` is HCMC-local, 1-12."""
    rainy_season = 5 <= month <= 11
    if soil_saturation is None:
        soil_saturation = 0.6 + min(rainfall / 100, 0.3) if rainy_season else 0.3 + min(rainfall / 200, 0.2)
    if drainage_capacity is None:
        drainage_capacity = 0.45
    terrain = PDIM_S1["flood"]["terrainDefault"]
    score = flood_risk_score(rainfall, soil_saturation, drainage_capacity, terrain)
    return {
        "overallRisk": flood_risk_level(score),
        "riskScore": js_round(score * 1000) / 1000,
        "affectedAreas": flood_areas(rainfall, min(soil_saturation + 0.05, 1)),
        # All four R_f terms (B-011): w1·P̃ + w2·T̃ + w3·Ĩ − w4·D̃ must be reproducible from these.
        "triggers": {
            "currentRainfall": rainfall,
            "soilSaturation": js_round(soil_saturation * 1000) / 1000,
            "drainageCapacity": drainage_capacity,
            "terrainSensitivity": terrain,
        },
    }
