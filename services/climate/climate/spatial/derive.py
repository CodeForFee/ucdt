"""Derive the static layers of spec §A.2–§A.4 once and commit them as derived.json.

    uv run --group derive python -m climate.spatial.derive

Needs network and the `derive` dependency group (rasterio). Runtime and CI never run this:
they read the committed derived.json through climate.spatial.catalogue. Output is
deterministic (sorted keys, fixed rounding, 2-space indent), so a re-run on the same upstream
data is byte-identical; the retrieval date is a UTC date, not a timestamp, for that reason.
"""

import json
import math
import os
import sys
import time
from collections import Counter
from datetime import UTC, datetime
from pathlib import Path

import httpx

from climate.spatial.units import AQI_POINTS, FLOOD_ZONES, HEAT_CELLS

OUT = Path(__file__).with_name("derived.json")
EARTH_RADIUS_M = 6_371_008.8  # IUGG mean radius, used for every offset and haversine here
USER_AGENT = "ucdt-research/0.1 (github.com/CodeForFee/ucdt)"

ELEVATION_URL = "https://api.open-meteo.com/v1/elevation"
ELEVATION_BATCH = 100  # the API's per-request coordinate limit
STENCIL_M = 500.0

WORLDCOVER_URL = (
    "https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/map/"
    "ESA_WorldCover_10m_2021_v200_N09E105_Map.tif"
)
WINDOW_M = 2000.0
CLASS_GROUPS = {"builtUp": (50,), "green": (10, 20, 30, 90, 95), "water": (80,)}
WORLDCOVER_NODATA = 0

OVERPASS_URL = "https://overpass-api.de/api/interpreter"
ADMIN_LEVEL = "6"
HIGHWAYS = ("motorway", "trunk", "primary", "secondary")
ROAD_RADIUS_M = 1000.0

REFERENCE_BOUNDS = {"rainfall_mm_h": 50, "elevation_m": 10, "slope_pct": 2}  # spec §B


# ── geometry ─────────────────────────────────────────────────────────────────
def haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * EARTH_RADIUS_M * math.asin(math.sqrt(a))


def offset_deg(lat: float, metres: float) -> tuple[float, float]:
    """(Δlat, Δlng) in degrees for `metres` north and east of latitude `lat`."""
    dlat = math.degrees(metres / EARTH_RADIUS_M)
    return dlat, dlat / math.cos(math.radians(lat))


def stencil(lat: float, lng: float) -> dict[str, tuple[float, float]]:
    """Centre and N/S/E/W at STENCIL_M, rounded to 6 decimals (≈ 0.1 m) for the request."""
    dlat, dlng = offset_deg(lat, STENCIL_M)
    pts = {"C": (lat, lng), "N": (lat + dlat, lng), "S": (lat - dlat, lng)}
    pts |= {"E": (lat, lng + dlng), "W": (lat, lng - dlng)}
    return {k: (round(a, 6), round(b, 6)) for k, (a, b) in pts.items()}


def slope_pct(z: dict[str, float]) -> float:
    """Spec §A.2: s = 100·max(|z_E − z_W|, |z_N − z_S|)/1000 (central differences over 1 km)."""
    return 100 * max(abs(z["E"] - z["W"]), abs(z["N"] - z["S"])) / (2 * STENCIL_M)


def road_length_km(lat: float, lng: float, ways: list[list[tuple[float, float]]]) -> float:
    """Spec §A.3: every node-to-node segment whose midpoint lies within ROAD_RADIUS_M of the unit
    counts with its full haversine length. The midpoint is the coordinate mean of the two nodes
    (segments are tens of metres, so the difference from the geodesic midpoint is negligible)."""
    total = 0.0
    for nodes in ways:
        for (a_lat, a_lng), (b_lat, b_lng) in zip(nodes, nodes[1:], strict=False):
            if haversine_m(lat, lng, (a_lat + b_lat) / 2, (a_lng + b_lng) / 2) <= ROAD_RADIUS_M:
                total += haversine_m(a_lat, a_lng, b_lat, b_lng)
    return total / 1000


def nearest(lat: float, lng: float, candidates) -> str:
    return min(candidates, key=lambda c: (haversine_m(lat, lng, c["lat"], c["lng"]), c["id"]))["id"]


# ── HTTP ─────────────────────────────────────────────────────────────────────
def _request(client: httpx.Client, method: str, url: str, **kw) -> httpx.Response:
    """Retry with exponential backoff on 429 / 5xx and transport errors; raise otherwise."""
    for attempt in range(8):
        try:
            r = client.request(method, url, **kw)
        except httpx.TransportError as e:
            err: object = e
        else:
            if r.status_code not in (429, 500, 502, 503, 504):
                r.raise_for_status()
                return r
            err = r.status_code
        wait = min(60, 2**attempt * 2)
        print(f"  {url}: {err}, retry in {wait}s", file=sys.stderr)
        time.sleep(wait)
    raise RuntimeError(f"{url}: gave up after retries")


def overpass(client: httpx.Client, query: str) -> dict:
    body = _request(client, "POST", OVERPASS_URL, data={"data": query}).json()
    time.sleep(1)  # be polite to the shared public instance
    return body


# ── the four layers ──────────────────────────────────────────────────────────
def fetch_elevations(client: httpx.Client, coords: list[tuple[float, float]]) -> dict:
    out: dict[tuple[float, float], float] = {}
    for i in range(0, len(coords), ELEVATION_BATCH):
        batch = coords[i : i + ELEVATION_BATCH]
        params = {
            "latitude": ",".join(f"{a:.6f}" for a, _ in batch),
            "longitude": ",".join(f"{b:.6f}" for _, b in batch),
        }
        elev = _request(client, "GET", ELEVATION_URL, params=params).json()["elevation"]
        assert len(elev) == len(batch), (len(elev), len(batch))
        out.update(zip(batch, (float(e) for e in elev), strict=True))
    return out


def land_cover(units: list[dict]) -> dict[str, dict[str, float]]:
    import rasterio  # the `derive` group only; CI never imports this module's network paths
    from rasterio.windows import from_bounds

    out = {}
    env = {"GDAL_DISABLE_READDIR_ON_OPEN": "EMPTY_DIR"}
    with rasterio.Env(**env), rasterio.open(f"/vsicurl/{WORLDCOVER_URL}") as src:
        b = src.bounds
        for u in units:
            dlat, dlng = offset_deg(u["lat"], WINDOW_M / 2)
            west, south, east, north = u["lng"] - dlng, u["lat"] - dlat, u["lng"] + dlng, u["lat"] + dlat
            assert b.left <= west and east <= b.right and b.bottom <= south and north <= b.top, u["id"]
            win = from_bounds(west, south, east, north, src.transform).round_offsets().round_lengths()
            counts = Counter(src.read(1, window=win).ravel().tolist())
            counts.pop(WORLDCOVER_NODATA, None)
            n = sum(counts.values())
            assert n > 0, u["id"]
            out[u["id"]] = {
                group: round(sum(counts[c] for c in classes) / n, 6) for group, classes in CLASS_GROUPS.items()
            }
            print(f"  worldcover {u['id']}: {out[u['id']]}", file=sys.stderr)
    return out


def commune(client: httpx.Client, lat: float, lng: float) -> tuple[str, int, str]:
    q = (
        f"[out:json][timeout:60];is_in({lat},{lng})->.a;"
        f'rel(pivot.a)["boundary"="administrative"]["admin_level"="{ADMIN_LEVEL}"];out tags;'
    )
    body = overpass(client, q)
    rels = body["elements"]
    assert len(rels) == 1, (lat, lng, [(r["id"], r["tags"].get("name")) for r in rels])
    return rels[0]["tags"]["name"], rels[0]["id"], body["osm3s"]["timestamp_osm_base"]


def road_density(client: httpx.Client, lat: float, lng: float) -> tuple[float, str]:
    hw = "|".join(HIGHWAYS)
    q = f'[out:json][timeout:120];way(around:{ROAD_RADIUS_M:.0f},{lat},{lng})["highway"~"^({hw})$"];out geom;'
    body = overpass(client, q)
    ways = [[(n["lat"], n["lon"]) for n in w["geometry"]] for w in sorted(body["elements"], key=lambda w: w["id"])]
    area_km2 = math.pi * (ROAD_RADIUS_M / 1000) ** 2
    return road_length_km(lat, lng, ways) / area_km2, body["osm3s"]["timestamp_osm_base"]


# ── assembly ─────────────────────────────────────────────────────────────────
def provenance(today: str, osm_base: str) -> dict:
    groups = {k: list(v) for k, v in CLASS_GROUPS.items()}
    return {
        "elevation": {
            "source": "Open-Meteo Elevation API",
            "url": ELEVATION_URL,
            "dataset": "Copernicus DEM GLO-90 (90 m), served by Open-Meteo",
            "licence": "Open-Meteo API data: CC BY 4.0",
            "attribution": (
                "© DLR e.V. 2010–2014 and © Airbus Defence and Space GmbH 2014–2018 provided under "
                "COPERNICUS by the European Union and ESA"
            ),
            "retrieved": today,
            "method": {
                "elevation": "z(i) at the unit coordinate",
                "slope": "s = 100·max(|z_E − z_W|, |z_N − z_S|)/1000",
                "stencilSpacing_m": STENCIL_M,
                "earthRadius_m": EARTH_RADIUS_M,
                "coordinateRounding": 6,
            },
        },
        "landCover": {
            "source": "ESA WorldCover 10 m 2021 v200 (Sentinel-1/2), tile N09E105",
            "url": WORLDCOVER_URL,
            "dataset": "ESA WorldCover 2021 v200",
            "doi": "10.5281/zenodo.7254221",
            "licence": "CC BY 4.0",
            "attribution": "© ESA WorldCover project 2021 / Contains modified Copernicus Sentinel data (2021)",
            "retrieved": today,
            "method": {
                "window_m": WINDOW_M,
                "window": "square centred on the unit, snapped to the 10 m pixel grid",
                "classGroups": groups,
                "denominator": "all valid pixels in the window (nodata 0 excluded)",
                "rounding": 6,
            },
        },
        "commune": {
            "source": "OpenStreetMap via Overpass API",
            "url": OVERPASS_URL,
            "dataset": f"OpenStreetMap, Overpass base {osm_base}",
            "licence": "ODbL 1.0",
            "attribution": "© OpenStreetMap contributors, ODbL 1.0",
            "retrieved": today,
            "method": {
                "query": "is_in(lat,lng) → relation boundary=administrative",
                "admin_level": ADMIN_LEVEL,
                "note": "2025 commune-level unit (Resolution 1685/NQ-UBTVQH15); context only, never scored",
            },
        },
        "roadDensity": {
            "source": "OpenStreetMap via Overpass API",
            "url": OVERPASS_URL,
            "dataset": f"OpenStreetMap, Overpass base {osm_base}",
            "licence": "ODbL 1.0",
            "attribution": "© OpenStreetMap contributors, ODbL 1.0",
            "retrieved": today,
            "method": {
                "highway": list(HIGHWAYS),
                "radius_m": ROAD_RADIUS_M,
                "rule": (
                    "ways within radius split into node-to-node segments; a segment counts with its full "
                    "haversine length when its midpoint (coordinate mean) lies within radius; "
                    "v = counted km / (π·1² km²)"
                ),
                "units": "km/km²",
                "appliesTo": "aqi_point",
                "rounding": 3,
            },
        },
        "floodToAqi": {
            "method": "flood zone → nearest AQI point by haversine (ties: smaller id)",
            "earthRadius_m": EARTH_RADIUS_M,
        },
    }


def derive() -> dict:
    today = datetime.now(UTC).date().isoformat()
    units = [{"kind": k, **u} for k, rows in _KINDS for u in rows]
    headers = {"User-Agent": USER_AGENT}
    with httpx.Client(headers=headers, timeout=180) as client:
        print("elevation …", file=sys.stderr)
        stencils = {u["id"]: stencil(u["lat"], u["lng"]) for u in units}
        coords = sorted({p for s in stencils.values() for p in s.values()})
        elev = fetch_elevations(client, coords)

        print("land cover …", file=sys.stderr)
        cover = land_cover(units)

        print("communes …", file=sys.stderr)
        by_coord: dict[tuple[float, float], tuple[str, int, str]] = {}
        for u in units:
            key = (u["lat"], u["lng"])
            if key not in by_coord:
                by_coord[key] = commune(client, *key)
                print(f"  {u['id']}: {by_coord[key][:2]}", file=sys.stderr)

        print("road density …", file=sys.stderr)
        roads = {}
        for p in AQI_POINTS:
            roads[p["id"]] = road_density(client, p["lat"], p["lng"])
            print(f"  {p['id']}: {roads[p['id']][0]:.3f} km/km²", file=sys.stderr)

    osm_bases = {c[2][:10] for c in by_coord.values()} | {r[1][:10] for r in roads.values()}
    out_units = {}
    for u in units:
        z = {k: elev[p] for k, p in stencils[u["id"]].items()}
        name, osm_id, _ = by_coord[(u["lat"], u["lng"])]
        row = {
            "kind": u["kind"],
            "elevation_m": round(z["C"], 2),
            "slope_pct": round(slope_pct(z), 3),
            **cover[u["id"]],
            "commune": name,
            "commune_osm_id": osm_id,
        }
        if u["kind"] == "aqi_point":
            row["roadDensity"] = round(roads[u["id"]][0], 3)
        out_units[u["id"]] = row

    return {
        "schemaVersion": 1,
        "referenceBounds": REFERENCE_BOUNDS,
        "units": out_units,
        "floodToAqi": {z["id"]: nearest(z["lat"], z["lng"], AQI_POINTS) for z in FLOOD_ZONES},
        "provenance": provenance(today, " / ".join(sorted(osm_bases))),
    }


_KINDS = (("flood_zone", FLOOD_ZONES), ("heat_cell", HEAT_CELLS), ("aqi_point", AQI_POINTS))


def dump(data: dict) -> str:
    return json.dumps(data, ensure_ascii=False, sort_keys=True, indent=2) + "\n"


if __name__ == "__main__":
    os.environ.setdefault("GDAL_DISABLE_READDIR_ON_OPEN", "EMPTY_DIR")
    OUT.write_text(dump(derive()), encoding="utf-8", newline="\n")
    print(f"wrote {OUT}", file=sys.stderr)
