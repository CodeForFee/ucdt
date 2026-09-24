"""Ports of Hackathon-BE/tests/{riskCalculator,scenarioValidation,spatialNaming}.test.ts."""

import math
import re
from datetime import datetime

import pytest

from climate.pdim import aqi, flood, heat
from climate.pdim.constants import PDIM_S1
from climate.pdim.risk import (
    aqi_level,
    aqi_nowcast_step,
    effective_temp,
    flood_risk_level,
    flood_risk_score,
    heat_index,
)
from climate.pdim.simulation import validate_scenario
from climate.spatial.units import AQI_POINTS, FLOOD_ZONES, HEAT_CELLS


# ── riskCalculator.test.ts ───────────────────────────────────────────────────
def test_flood_risk_score_paper_case():
    # 0.45·(0.1/50) + 0.30·0.50 + 0.25·0.60 − 0.15·0.45 = 0.2334
    assert flood_risk_score(0.1, 0.6, 0.45, 0.5) == pytest.approx(0.2334, abs=5e-4)


def test_flood_risk_score_bounds():
    assert flood_risk_score(100, 1.0, 0.0, 1.0) == 1.0
    assert flood_risk_score(0, 0, 1.0, 0) == 0


def test_flood_risk_level_bands():
    cases = {0.10: "low", 0.24: "low", 0.25: "medium", 0.49: "medium", 0.50: "high", 0.74: "high"}
    cases |= {0.75: "critical", 0.95: "critical"}
    for score, band in cases.items():
        assert flood_risk_level(score) == band, score


def test_aqi_nowcast_step():
    assert aqi_nowcast_step(100, 0, 0) == 100
    assert aqi_nowcast_step(100, 30, 50) == pytest.approx(80.75, abs=5e-3)  # 100·0.95·0.85


def test_heat_index_and_uhi_bonus():
    hi = heat_index(33, 70)
    assert hi > 33
    assert effective_temp(33, 70, 0.85) == pytest.approx(hi + 0.85 * PDIM_S1["heat"]["uhiMaxDeg"], abs=5e-3)


def test_aqi_level():
    cases = {30: "good", 75: "moderate", 120: "unhealthy_sensitive", 170: "unhealthy"}
    cases |= {250: "very_unhealthy", 350: "hazardous"}
    for v, level in cases.items():
        assert aqi_level(v) == level


# ── scenarioValidation.test.ts ───────────────────────────────────────────────
BASE = {"rainfallIncrease": 50, "rainfallDurationHours": 3, "addGreenCoverage": 0, "trafficReduction": 0}


def s(**over):
    return {**BASE, **over}


def test_accepts_default_and_density_range():
    assert validate_scenario(BASE) is None
    for d in (0, 0.5, 0.8, 1):
        assert validate_scenario(s(urbanDensity=d)) is None
    assert validate_scenario(s(urbanDensity=None)) is None  # omitted -> baseline


@pytest.mark.parametrize(
    ("over", "field"),
    [
        ({"rainfallIncrease": -1}, "rainfallIncrease"),
        ({"rainfallIncrease": 501}, "rainfallIncrease"),
        ({"rainfallDurationHours": -1}, "rainfallDurationHours"),
        ({"rainfallDurationHours": 73}, "rainfallDurationHours"),
        ({"addGreenCoverage": 101}, "addGreenCoverage"),
        ({"addGreenCoverage": -101}, "addGreenCoverage"),
        ({"trafficReduction": -1}, "trafficReduction"),
        ({"trafficReduction": 101}, "trafficReduction"),
        ({"urbanDensity": 1.5}, "urbanDensity"),
        ({"urbanDensity": -0.1}, "urbanDensity"),
    ],
)
def test_rejects_out_of_range(over, field):
    err = validate_scenario(s(**over))
    assert err is not None and field in err


def test_rejects_nan_inf_and_non_numbers():
    assert validate_scenario(s(rainfallIncrease=math.nan)) is not None
    assert validate_scenario(s(urbanDensity=math.nan)) is not None
    assert validate_scenario(s(trafficReduction=math.inf)) is not None
    assert validate_scenario(s(rainfallIncrease="50")) is not None
    assert validate_scenario(s(rainfallIncrease=True)) is not None
    assert validate_scenario({k: v for k, v in BASE.items() if k != "trafficReduction"}) is not None


def test_accepts_boundaries():
    for over in ({"rainfallIncrease": 0}, {"rainfallIncrease": 500}, {"trafficReduction": 100}):
        assert validate_scenario(s(**over)) is None


# ── spatialNaming.test.ts (BOARD Decision 2026-09-14: toponyms, never admin units) ──
ADMIN_LABEL = re.compile(r"\b(Quận|Huyện|Phường|Xã|District|Ward|TP\.\s*Thủ Đức)\b", re.IGNORECASE)
DATASETS = [("flood zones", FLOOD_ZONES, 18), ("heat cells", HEAT_CELLS, 22), ("AQI points", AQI_POINTS, 23)]


@pytest.mark.parametrize(("label", "rows", "count"), DATASETS, ids=[d[0] for d in DATASETS])
def test_spatial_units(label, rows, count):
    assert len(rows) == count
    assert [r["name"] for r in rows if ADMIN_LABEL.search(r["name"])] == []
    assert [r["name"] for r in rows if " - " in r["name"]] == []
    assert len({r["id"] for r in rows}) == len(rows)
    assert all(r["name"].strip() for r in rows)
    # Cần Giờ (10.41 N) to Củ Chi (11.01 N); 106.50 E to 106.96 E.
    assert all(10.3 <= r["lat"] <= 11.1 and 106.4 <= r["lng"] <= 107.05 for r in rows)


def test_api_surface_names_carry_no_admin_label():
    """Every name that reaches a payload comes from the toponym tables."""
    now = datetime.fromisoformat("2026-09-23T10:00:00Z")
    raw = aqi.raw_from_open_meteo({"pm2_5": 30})
    cur = {"temperature": 33, "humidity": 70}
    payloads = [
        flood.compute_flood({z["id"]: 80 for z in FLOOD_ZONES}, 80)["affectedAreas"],
        heat.compute_heat({c["id"]: cur for c in HEAT_CELLS}, cur, now)["hotspots"],
        aqi.compute_aqi(raw, [raw] * len(AQI_POINTS), [], now)["stations"],
    ]
    names = [row["name"] for rows in payloads for row in rows]
    assert len(names) == 18 + 22 + 23
    assert [n for n in names if ADMIN_LABEL.search(n)] == []
