"""Typed, network-free view of the 63 spatial units: units.py (ids, toponyms, coordinates,
localDrain) joined with the committed static layers in derived.json (spec §A.2–§A.4).

Raw values only. Normalisation (T̃, ṽ, ρ₀, G₀ …) is processing and lives in climate.pdim.

    from climate.spatial.catalogue import load_catalogue, legacy_catalogue
    cat = load_catalogue()                 # measured layers (the S-002 model)
    cat.flood_zones[0].elevation_m, cat.flood_to_aqi["gz-q8-rach-ong"]
    old = legacy_catalogue()               # legacy expert constants (parity tests only)
"""

import json
import math
from collections.abc import Mapping
from dataclasses import dataclass
from functools import cache
from pathlib import Path
from types import MappingProxyType

from climate.spatial.units import AQI_POINTS, FLOOD_ZONES, HEAT_CELLS

DERIVED_PATH = Path(__file__).with_name("derived.json")


@dataclass(frozen=True)
class _Unit:
    id: str
    name: str  # toponym (spec §A.1)
    lat: float
    lng: float
    elevation_m: float  # z(i), Copernicus DEM GLO-90
    slope_pct: float  # s(i), 3×3 stencil at 500 m
    built_up: float  # WorldCover class 50 fraction, 2 km window
    green: float  # WorldCover classes 10, 20, 30, 90, 95
    water: float  # WorldCover class 80
    commune: str | None  # 2025 commune (OSM admin_level 6); context only, never scored
    commune_osm_id: int | None


@dataclass(frozen=True)
class FloodZone(_Unit):
    local_drain: float  # D̃(i), expert-judgement constant (spec §B, DP3)


@dataclass(frozen=True)
class HeatCell(_Unit):
    pass


@dataclass(frozen=True)
class AqiPoint(_Unit):
    road_density: float  # v(i) km/km², OSM motorway..secondary within 1 km


@dataclass(frozen=True)
class Catalogue:
    flood_zones: tuple[FloodZone, ...]
    heat_cells: tuple[HeatCell, ...]
    aqi_points: tuple[AqiPoint, ...]
    flood_to_aqi: Mapping[str, str]  # flood zone id → nearest AQI point id (§A.4)
    reference_bounds: Mapping[str, float]  # §B fixed normalisation bounds
    provenance: Mapping[str, object]

    def aqi_point(self, unit_id: str) -> AqiPoint:
        return next(p for p in self.aqi_points if p.id == unit_id)

    @property
    def mean_built_up_heat(self) -> float:
        """ρ₀ input: mean builtUp over the 22 heat cells (spec §C)."""
        return sum(c.built_up for c in self.heat_cells) / len(self.heat_cells)

    @property
    def mean_green_heat(self) -> float:
        """G₀ input: mean green fraction over the 22 heat cells (spec §C)."""
        return sum(c.green for c in self.heat_cells) / len(self.heat_cells)


def _base(u: dict, d: dict) -> dict:
    return {
        "id": u["id"],
        "name": u["name"],
        "lat": u["lat"],
        "lng": u["lng"],
        "elevation_m": d["elevation_m"],
        "slope_pct": d["slope_pct"],
        "built_up": d["builtUp"],
        "green": d["green"],
        "water": d["water"],
        "commune": d["commune"],
        "commune_osm_id": d["commune_osm_id"],
    }


def _read(path: Path) -> dict:
    data = json.loads(path.read_text(encoding="utf-8"))
    expected = {u["id"] for rows in (FLOOD_ZONES, HEAT_CELLS, AQI_POINTS) for u in rows}
    if set(data["units"]) != expected:
        raise ValueError(f"{path}: unit ids differ from units.py: {sorted(set(data['units']) ^ expected)}")
    return data


def _freeze(m: dict) -> Mapping:
    return MappingProxyType(m)


@cache
def load_catalogue(path: Path = DERIVED_PATH) -> Catalogue:
    """The catalogue the S-002 model scores: units.py + the committed derived.json."""
    data = _read(path)
    d = data["units"]
    return Catalogue(
        flood_zones=tuple(
            FloodZone(**_base(z, d[z["id"]]), local_drain=z["localDrain"]) for z in FLOOD_ZONES
        ),
        heat_cells=tuple(HeatCell(**_base(c, d[c["id"]])) for c in HEAT_CELLS),
        aqi_points=tuple(
            AqiPoint(**_base(p, d[p["id"]]), road_density=d[p["id"]]["roadDensity"]) for p in AQI_POINTS
        ),
        flood_to_aqi=_freeze(dict(data["floodToAqi"])),
        reference_bounds=_freeze(dict(data["referenceBounds"])),
        provenance=_freeze(data["provenance"]),
    )


@cache
def legacy_catalogue() -> Catalogue:
    """The same shapes filled from the legacy expert constants, for the formula-parity tests.

    - Heat cells: built_up = urbanDensity (the legacy ρ).
    - Flood zones: local_drain = localDrain; elevation_m / slope_pct are the inverse of the §B
      T̃ normalisation for the legacy terrain constant, so T̃(z, s) == terrain exactly:
      z = z_ref·(1 − terrain), s = s_ref·(1 − terrain) (terrain 0.60 → 4 m, 0.8 %).
    - AQI points: road_density = 1.0 everywhere, i.e. ṽ(i) = 1 (legacy uniform traffic).
    - Everything the legacy model never had (flood-zone land cover, heat/AQI terrain, green,
      water) is NaN so any accidental use fails loudly; commune is None.
    Mapping and reference bounds are the committed ones (pure geometry / fixed constants).
    """
    derived = load_catalogue()
    zb, sb = derived.reference_bounds["elevation_m"], derived.reference_bounds["slope_pct"]
    nan = math.nan

    def base(u: dict, **over: float) -> dict:
        row = {"id": u["id"], "name": u["name"], "lat": u["lat"], "lng": u["lng"]}
        row |= {"elevation_m": nan, "slope_pct": nan, "built_up": nan, "green": nan, "water": nan}
        return row | {"commune": None, "commune_osm_id": None} | over

    return Catalogue(
        flood_zones=tuple(
            FloodZone(
                **base(z, elevation_m=zb * (1 - z["terrain"]), slope_pct=sb * (1 - z["terrain"])),
                local_drain=z["localDrain"],
            )
            for z in FLOOD_ZONES
        ),
        heat_cells=tuple(HeatCell(**base(c, built_up=c["urbanDensity"])) for c in HEAT_CELLS),
        aqi_points=tuple(AqiPoint(**base(p), road_density=1.0) for p in AQI_POINTS),
        flood_to_aqi=derived.flood_to_aqi,
        reference_bounds=derived.reference_bounds,
        provenance=_freeze(
            {"source": "legacy expert constants (units.py localDrain, terrain, urbanDensity)"}
        ),
    )
