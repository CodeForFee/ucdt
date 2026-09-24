"""derived.json (spec §A.2–§A.4): schema, value ranges, provenance, mapping; plus the pure
geometry rules of derive.py (no network)."""

import json

import httpx
import pytest

from climate.spatial import derive
from climate.spatial.catalogue import DERIVED_PATH, legacy_catalogue, load_catalogue
from climate.spatial.units import ALL_UNITS, AQI_POINTS, FLOOD_ZONES

DATA = json.loads(DERIVED_PATH.read_text(encoding="utf-8"))
FRACTIONS = ("builtUp", "green", "water")
COMMON = {"kind", "elevation_m", "slope_pct", *FRACTIONS, "commune", "commune_osm_id"}


def test_top_level_and_bytes_are_canonical():
    assert set(DATA) == {"schemaVersion", "referenceBounds", "units", "floodToAqi", "provenance"}
    assert DATA["referenceBounds"] == {"rainfall_mm_h": 50, "elevation_m": 10, "slope_pct": 2}
    # The committed file is exactly what derive.dump writes (sorted keys, 2-space indent).
    assert DERIVED_PATH.read_text(encoding="utf-8") == derive.dump(DATA)


def test_rederive_from_committed_cache_offline_is_byte_identical():
    def offline(request):
        raise AssertionError(f"network call with a complete cache: {request.url}")

    cache_text = derive.CACHE.read_text(encoding="utf-8")
    cache = json.loads(cache_text)
    with httpx.Client(transport=httpx.MockTransport(offline)) as client:
        assert derive.dump(derive.derive(cache, client)) == DERIVED_PATH.read_text(encoding="utf-8")
    assert derive.dump(cache) == cache_text  # nothing added: every request was a cache hit


def test_every_unit_present_with_its_schema():
    assert {u["id"]: u["kind"] for u in ALL_UNITS} == {k: v["kind"] for k, v in DATA["units"].items()}
    for uid, row in DATA["units"].items():
        expected = COMMON | ({"roadDensity"} if row["kind"] == "aqi_point" else set())
        assert set(row) == expected, uid
        assert isinstance(row["commune"], str) and isinstance(row["commune_osm_id"], int), uid


@pytest.mark.parametrize("uid", sorted(DATA["units"]))
def test_value_ranges(uid):
    row = DATA["units"][uid]
    assert all(0 <= row[k] <= 1 for k in FRACTIONS)
    assert sum(row[k] for k in FRACTIONS) <= 1 + 3e-6  # 6-decimal rounding slack
    assert -5 <= row["elevation_m"] <= 100
    assert row["slope_pct"] >= 0
    assert row.get("roadDensity", 0) >= 0


def test_provenance_fields():
    prov = DATA["provenance"]
    assert set(prov) == {"elevation", "landCover", "commune", "roadDensity", "floodToAqi"}
    for name in ("elevation", "landCover", "commune", "roadDensity"):
        p = prov[name]
        for field in ("source", "url", "dataset", "licence", "attribution", "retrieved", "method"):
            assert p.get(field), (name, field)
    assert "Copernicus DEM GLO-90" in prov["elevation"]["dataset"]
    assert "CC BY 4.0" in prov["elevation"]["licence"]
    assert "COPERNICUS by the European Union and ESA" in prov["elevation"]["attribution"]
    assert (
        prov["landCover"]["doi"] == "10.5281/zenodo.7254221" and prov["landCover"]["licence"] == "CC BY 4.0"
    )
    assert prov["landCover"]["method"]["classGroups"] == {
        "builtUp": [50],
        "green": [10, 20, 30, 90, 95],
        "water": [80],
    }
    assert prov["landCover"]["method"]["window_m"] == 2000
    assert prov["elevation"]["method"]["stencilSpacing_m"] == 500
    assert prov["roadDensity"]["method"]["highway"] == ["motorway", "trunk", "primary", "secondary"]
    assert prov["roadDensity"]["method"]["radius_m"] == 1000
    for name in ("commune", "roadDensity"):
        assert prov[name]["attribution"] == "© OpenStreetMap contributors, ODbL 1.0"


def test_flood_to_aqi_covers_all_zones_with_the_nearest_point():
    mapping = DATA["floodToAqi"]
    assert set(mapping) == {z["id"] for z in FLOOD_ZONES}
    for z in FLOOD_ZONES:
        dist = {p["id"]: derive.haversine_m(z["lat"], z["lng"], p["lat"], p["lng"]) for p in AQI_POINTS}
        assert dist[mapping[z["id"]]] == min(dist.values()), z["id"]


# ── pure rules of derive.py ─────────────────────────────────────────────────
def test_stencil_spacing_and_slope():
    st = derive.stencil(10.7769, 106.7009)
    for k in "NSEW":
        assert derive.haversine_m(*st["C"], *st[k]) == pytest.approx(500, abs=0.2), k
    # s = 100·max(|zE − zW|, |zN − zS|)/1000
    assert derive.slope_pct({"C": 0, "N": 3, "S": 1, "E": 0, "W": 5}) == pytest.approx(0.5)


def test_road_length_counts_segments_by_midpoint():
    lat, lng = 10.8, 106.7
    dlat, _ = derive.offset_deg(lat, 1)  # degrees per metre northward
    # One way, three segments due north: midpoints at 250 m, 750 m and 1250 m.
    way = [(lat + dlat * m, lng) for m in (0, 500, 1000, 1500)]
    assert derive.road_length_km(lat, lng, [way]) == pytest.approx(1.0, rel=1e-6)
    # A segment straddling the radius counts in full when its midpoint is inside (900 → 1090 m).
    assert derive.road_length_km(lat, lng, [[(lat + dlat * 900, lng), (lat + dlat * 1090, lng)]]) == (
        pytest.approx(0.19, rel=1e-6)
    )
    assert derive.road_length_km(lat, lng, [[(lat + dlat * 1001, lng), (lat + dlat * 1200, lng)]]) == 0


def test_fractions_exclude_nodata():
    hist = {"0": 50, "50": 30, "10": 10, "95": 5, "80": 5}  # 50 nodata pixels, 50 valid
    assert derive.fractions(hist) == {"builtUp": 0.6, "green": 0.3, "water": 0.1}
    with pytest.raises(ValueError):
        derive.fractions({"0": 7})


# ── catalogue ───────────────────────────────────────────────────────────────
def test_catalogue_joins_units_and_layers():
    cat = load_catalogue()
    assert (len(cat.flood_zones), len(cat.heat_cells), len(cat.aqi_points)) == (18, 22, 23)
    row, q1 = DATA["units"]["station-q1"], cat.aqi_point("station-q1")
    assert (q1.built_up, q1.road_density, q1.commune) == (row["builtUp"], row["roadDensity"], row["commune"])
    assert dict(cat.flood_to_aqi) == DATA["floodToAqi"]


def test_legacy_catalogue_inverts_terrain():
    """T̃ = ½(1 − min(z/10, 1)) + ½(1 − min(s/2, 1)) (spec §B) reproduces the legacy terrain."""
    for zone, src in zip(legacy_catalogue().flood_zones, FLOOD_ZONES, strict=True):
        t = 0.5 * (1 - min(zone.elevation_m / 10, 1)) + 0.5 * (1 - min(zone.slope_pct / 2, 1))
        assert t == pytest.approx(src["terrain"], abs=1e-12), zone.id
