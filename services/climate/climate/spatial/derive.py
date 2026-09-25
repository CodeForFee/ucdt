"""Derive the static layers of spec §A.2–§A.4 once and commit them as derived.json.

    uv run --group derive python -m climate.spatial.derive

Every upstream answer (Open-Meteo Elevation, ESA WorldCover windows, Overpass) goes through the
committed response cache derive_cache.json, keyed by request, with the UTC retrieval date per
source. A key that is in the cache is never fetched again, so a re-run — with the network off —
rebuilds derived.json byte-identically (sorted keys, fixed rounding, 2-space indent). Missing keys
are fetched (network + the `derive` dependency group for rasterio) and added. To re-derive from
fresh upstream data, delete derive_cache.json. Runtime and CI never run this: they read the
committed derived.json through climate.spatial.catalogue.

Cache contents, per source (what the method reads, not the raw bytes):
- elevation: "lat,lng" (6 decimals) → z [m];
- worldcover: "west,south,east,north" of the 2 km window → {class: pixel count} (nodata included);
- overpass: query text → {timestamp_osm_base, elements: [{id, name?, geometry?: [[lat, lon], …]}]}.
"""

import json
import math
import sys
import time
from collections import Counter
from datetime import UTC, datetime
from pathlib import Path

import httpx

from climate.spatial.units import AQI_POINTS, FLOOD_ZONES, HEAT_CELLS

OUT = Path(__file__).with_name("derived.json")
CACHE = Path(__file__).with_name("derive_cache.json")
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


def window_bounds(lat: float, lng: float) -> tuple[float, float, float, float]:
    """(west, south, east, north) of the WINDOW_M square centred on the unit, 6 decimals."""
    dlat, dlng = offset_deg(lat, WINDOW_M / 2)
    return tuple(round(v, 6) for v in (lng - dlng, lat - dlat, lng + dlng, lat + dlat))


def fractions(hist: dict[str, int]) -> dict[str, float]:
    """Spec §A.2 class-group fractions over the valid (non-nodata) pixels of one window."""
    counts = {int(k): n for k, n in hist.items() if int(k) != WORLDCOVER_NODATA}
    total = sum(counts.values())
    if total == 0:
        raise ValueError("window has no valid WorldCover pixel")
    return {g: round(sum(counts.get(c, 0) for c in cls) / total, 6) for g, cls in CLASS_GROUPS.items()}


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


# ── cache + HTTP ─────────────────────────────────────────────────────────────
def responses(cache: dict, source: str) -> dict:
    """The cached responses of one source; a new source is stamped with today's UTC date."""
    today = datetime.now(UTC).date().isoformat()
    return cache.setdefault(source, {"retrieved": today, "responses": {}})["responses"]


def _get_json(client: httpx.Client, method: str, url: str, **kw) -> dict:
    """Retry with exponential backoff on 429 / 5xx, transport errors, a body that is not JSON and
    an Overpass `remark` (a runtime error that comes back as a partial 200); raise otherwise."""
    for attempt in range(8):
        try:
            r = client.request(method, url, **kw)
            if r.status_code in (429, 500, 502, 503, 504):
                err: object = r.status_code
            else:
                r.raise_for_status()
                body = r.json()
                if "remark" not in body:
                    return body
                err = body["remark"]
        except (httpx.TransportError, ValueError) as e:
            err = e
        wait = min(60, 2**attempt * 2)
        print(f"  {url}: {err}, retry in {wait}s", file=sys.stderr)
        time.sleep(wait)
    raise RuntimeError(f"{url}: gave up after retries")


def overpass(client: httpx.Client, cache: dict, query: str) -> dict:
    resp = responses(cache, "overpass")
    if query not in resp:
        body = _get_json(client, "POST", OVERPASS_URL, data={"data": query})
        time.sleep(1)  # be polite to the shared public instance
        elements = []
        for e in sorted(body["elements"], key=lambda e: e["id"]):
            row = {"id": e["id"]}
            if "name" in e.get("tags", {}):
                row["name"] = e["tags"]["name"]
            if "geometry" in e:
                row["geometry"] = [[n["lat"], n["lon"]] for n in e["geometry"]]
            elements.append(row)
        resp[query] = {"timestamp_osm_base": body["osm3s"]["timestamp_osm_base"], "elements": elements}
    return resp[query]


# ── the four layers ──────────────────────────────────────────────────────────
def _key(values) -> str:
    return ",".join(f"{v:.6f}" for v in values)


def elevations(client: httpx.Client, cache: dict, coords: list[tuple[float, float]]) -> dict:
    resp = responses(cache, "elevation")
    missing = [c for c in coords if _key(c) not in resp]
    for i in range(0, len(missing), ELEVATION_BATCH):
        batch = missing[i : i + ELEVATION_BATCH]
        params = {
            "latitude": ",".join(f"{a:.6f}" for a, _ in batch),
            "longitude": ",".join(f"{b:.6f}" for _, b in batch),
        }
        elev = _get_json(client, "GET", ELEVATION_URL, params=params)["elevation"]
        if len(elev) != len(batch):
            raise RuntimeError(f"elevation: {len(elev)} values for {len(batch)} coordinates")
        resp.update({_key(c): float(e) for c, e in zip(batch, elev, strict=True)})
    return {c: resp[_key(c)] for c in coords}


def land_cover(cache: dict, units: list[dict]) -> dict[str, dict[str, float]]:
    resp = responses(cache, "worldcover")
    boxes = {u["id"]: window_bounds(u["lat"], u["lng"]) for u in units}
    missing = sorted({b for b in boxes.values() if _key(b) not in resp})
    if missing:
        import rasterio  # the `derive` group only, and only when a window is not cached
        from rasterio.windows import from_bounds

        with (
            rasterio.Env(GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR"),
            rasterio.open(f"/vsicurl/{WORLDCOVER_URL}") as src,
        ):
            t = src.bounds
            for west, south, east, north in missing:
                if not (t.left <= west and east <= t.right and t.bottom <= south and north <= t.top):
                    raise ValueError(f"window {west, south, east, north} is outside the tile")
                win = from_bounds(west, south, east, north, src.transform).round_offsets().round_lengths()
                counts = Counter(src.read(1, window=win).ravel().tolist())
                resp[_key((west, south, east, north))] = {str(k): n for k, n in counts.items()}
                print(f"  worldcover {west, south, east, north}: {len(counts)} classes", file=sys.stderr)
    return {uid: fractions(resp[_key(b)]) for uid, b in boxes.items()}


def commune(client: httpx.Client, cache: dict, lat: float, lng: float) -> tuple[str, int]:
    q = (
        f"[out:json][timeout:60];is_in({lat},{lng})->.a;"
        f'rel(pivot.a)["boundary"="administrative"]["admin_level"="{ADMIN_LEVEL}"];out tags;'
    )
    rels = overpass(client, cache, q)["elements"]
    if len(rels) != 1:
        raise ValueError(f"({lat}, {lng}): expected one admin_level {ADMIN_LEVEL} relation, got {rels}")
    return rels[0]["name"], rels[0]["id"]


def road_density(client: httpx.Client, cache: dict, lat: float, lng: float) -> float:
    hw = "|".join(HIGHWAYS)
    q = f'[out:json][timeout:120];way(around:{ROAD_RADIUS_M:.0f},{lat},{lng})["highway"~"^({hw})$"];out geom;'
    ways = [[tuple(n) for n in w["geometry"]] for w in overpass(client, cache, q)["elements"]]
    return road_length_km(lat, lng, ways) / (math.pi * (ROAD_RADIUS_M / 1000) ** 2)


# ── assembly ─────────────────────────────────────────────────────────────────
def provenance(cache: dict) -> dict:
    osm = cache["overpass"]
    osm_bases = " / ".join(sorted({r["timestamp_osm_base"][:10] for r in osm["responses"].values()}))
    osm_common = {
        "source": "OpenStreetMap via Overpass API",
        "url": OVERPASS_URL,
        "dataset": f"OpenStreetMap, Overpass base {osm_bases}",
        "licence": "ODbL 1.0",
        "attribution": "© OpenStreetMap contributors, ODbL 1.0",
        "retrieved": osm["retrieved"],
    }
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
            "retrieved": cache["elevation"]["retrieved"],
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
            "attribution": (
                "© ESA WorldCover project 2021 / Contains modified Copernicus Sentinel data (2021)"
            ),
            "retrieved": cache["worldcover"]["retrieved"],
            "method": {
                "window_m": WINDOW_M,
                "window": "square centred on the unit, snapped to the 10 m pixel grid",
                "classGroups": {k: list(v) for k, v in CLASS_GROUPS.items()},
                "denominator": "all valid pixels in the window (nodata 0 excluded)",
                "rounding": 6,
            },
        },
        "commune": osm_common
        | {
            "method": {
                "query": "is_in(lat,lng) → relation boundary=administrative",
                "admin_level": ADMIN_LEVEL,
                "note": "2025 commune-level unit (Resolution 1685/NQ-UBTVQH15); context only, never scored",
            },
        },
        "roadDensity": osm_common
        | {
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


_KINDS = (("flood_zone", FLOOD_ZONES), ("heat_cell", HEAT_CELLS), ("aqi_point", AQI_POINTS))


def derive(cache: dict, client: httpx.Client) -> dict:
    """derived.json from `cache` (filled in place for anything missing, through `client`)."""
    units = [{"kind": k, **u} for k, rows in _KINDS for u in rows]
    stencils = {u["id"]: stencil(u["lat"], u["lng"]) for u in units}
    elev = elevations(client, cache, sorted({p for s in stencils.values() for p in s.values()}))
    cover = land_cover(cache, units)
    communes = {u["id"]: commune(client, cache, u["lat"], u["lng"]) for u in units}
    roads = {p["id"]: road_density(client, cache, p["lat"], p["lng"]) for p in AQI_POINTS}

    out_units = {}
    for u in units:
        z = {k: elev[p] for k, p in stencils[u["id"]].items()}
        name, osm_id = communes[u["id"]]
        row = {
            "kind": u["kind"],
            "elevation_m": round(z["C"], 2),
            "slope_pct": round(slope_pct(z), 3),
            **cover[u["id"]],
            "commune": name,
            "commune_osm_id": osm_id,
        }
        if u["kind"] == "aqi_point":
            row["roadDensity"] = round(roads[u["id"]], 3)
        out_units[u["id"]] = row

    return {
        "schemaVersion": 1,
        "referenceBounds": REFERENCE_BOUNDS,
        "units": out_units,
        "floodToAqi": {z["id"]: nearest(z["lat"], z["lng"], AQI_POINTS) for z in FLOOD_ZONES},
        "provenance": provenance(cache),
    }


def dump(data: dict) -> str:
    return json.dumps(data, ensure_ascii=False, sort_keys=True, indent=2) + "\n"


def main() -> None:
    cache = json.loads(CACHE.read_text(encoding="utf-8")) if CACHE.exists() else {}
    try:
        with httpx.Client(headers={"User-Agent": USER_AGENT}, timeout=180) as client:
            data = derive(cache, client)
    finally:  # keep whatever was fetched, even when a later request fails
        CACHE.write_text(dump(cache), encoding="utf-8", newline="\n")
    OUT.write_text(dump(data), encoding="utf-8", newline="\n")
    print(f"wrote {OUT}", file=sys.stderr)


if __name__ == "__main__":
    main()
