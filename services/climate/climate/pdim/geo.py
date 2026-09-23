"""GeoJSON helpers, ported from Hackathon-BE/src/utils/geoUtils.ts."""

import math


def _seeded_rand(a: float, b: float) -> float:
    """Deterministic pseudo-random in [0, 1) from two numbers."""
    x = math.sin(a * 127.1 + b * 311.7) * 43758.5453
    return x - math.floor(x)


def generate_flood_polygon(center_lat: float, center_lng: float, radius_km: float, risk_score: float) -> dict:
    """A reproducible irregular 20-vertex blob around a zone, growing with risk."""
    base_radius = radius_km * (1.2 + risk_score * 1.5)
    lat_scale = 1 / 111
    lng_scale = 1 / (111 * math.cos((center_lat * math.pi) / 180))
    n = 20
    coords = []
    for i in range(n):
        angle = (i / n) * 2 * math.pi
        r = base_radius * (0.55 + 0.45 * _seeded_rand(center_lat + i * 0.317, center_lng + i * 0.713))
        coords.append(
            [center_lng + math.cos(angle) * r * lng_scale, center_lat + math.sin(angle) * r * lat_scale]
        )
    coords.append(coords[0])
    return {"type": "Polygon", "coordinates": [coords]}


def create_geojson_feature(geometry: dict, properties: dict) -> dict:
    return {"type": "Feature", "geometry": geometry, "properties": properties}


def haversine_distance(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Great-circle distance in km."""
    d_lat = ((lat2 - lat1) * math.pi) / 180
    d_lng = ((lng2 - lng1) * math.pi) / 180
    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos((lat1 * math.pi) / 180) * math.cos((lat2 * math.pi) / 180) * math.sin(d_lng / 2) ** 2
    )
    return 6371 * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
