"""Regression invariants for bugs fixed in the legacy repos: B-004, B-005, B-008, B-011,
plus alert first-call / dedupe semantics.
"""

import itertools
from datetime import datetime, timedelta

import pytest

from climate.pdim import aqi, flood, rules, simulation
from climate.pdim.constants import PDIM_S1
from climate.pdim.risk import js_round

NOW = datetime.fromisoformat("2026-09-23T10:00:00Z")


def weather(temp=31, hum=70, rain=0):
    return {"current": {"temperature": temp, "humidity": hum, "rainfall": rain}, "forecast": []}


def aqi_payload(value):
    return {"aqi": value}


# ── B-004: urbanDensity reaches the UHI term of tempDelta ──────────────────────
def test_b004_urban_density_moves_temp_delta():
    w, fl, aq = weather(), flood.compute_flood(0, 9), aqi_payload(80)
    heat_only = {
        "rainfallIncrease": 0,
        "rainfallDurationHours": 0,
        "addGreenCoverage": 0,
        "trafficReduction": 0,
    }

    def delta(**over):
        return simulation.run_simulation({**heat_only, **over}, w, fl, aq, NOW)["results"]["tempDelta"]

    low, high = delta(urbanDensity=0.3), delta(urbanDensity=0.95)
    assert low < 0 < high
    assert delta() == 0 and delta(urbanDensity=None) == 0
    assert delta(urbanDensity=PDIM_S1["heat"]["densityBaseline"]) == 0


# ── recommendation grid: hits every rule in R plus the default state ──────────
def _grid():
    for score, rain, a, (t, h) in itertools.product(
        (0.1, 0.3, 0.6, 0.8), (10, 50), (50, 120, 170, 250), ((25, 50), (32, 50), (33, 55))
    ):
        n_areas = 3 if score > 0.2 else 0
        fl = {"riskScore": score, "affectedAreas": [{"name": f"Z{i}"} for i in range(n_areas)]}
        yield rules.recommendations(weather(t, h, rain), fl, aqi_payload(a), NOW)


GRID = list(_grid())
SB_OF = {"urgent": 4, "high": 3, "medium": 2}


def test_grid_fires_every_rule():
    fired = {r["ruleId"] for res in GRID for r in res["recommendations"]}
    expected = {f"R-FLOOD-0{i}" for i in (1, 2, 3)} | {f"R-AQI-0{i}" for i in (1, 2, 3)}
    assert fired == expected | {"R-HEAT-01", "R-HEAT-02", "R-COMB-01", "R-NORM-00"}


def test_b005_every_recommendation_is_traceable():
    for res in GRID:
        for r in res["recommendations"]:
            assert r["ruleId"] and isinstance(r["priorityScore"], int | float)
            assert isinstance(r["inputs"], dict) and r["inputs"]["exposureE"] > 0
            assert r["actionItems"]


def test_b008_uniform_band_to_priority_and_norm_zero():
    for res in GRID:
        recs = res["recommendations"]
        scores = [r["priorityScore"] for r in recs]
        assert scores == sorted(scores, reverse=True)
        norm = [r for r in recs if r["ruleId"] == "R-NORM-00"]
        if norm:
            assert len(recs) == 1 and norm[0]["priorityScore"] == 0 and res["overallRiskLevel"] == "low"
            continue
        for r in recs:
            sb = SB_OF[r["priority"]]
            e, fa = r["inputs"]["exposureE"], r["inputs"]["feasibilityFa"]
            assert r["priorityScore"] > 0
            assert r["priorityScore"] == js_round(sb * e * fa * 100) / 100
            assert r["priority"] == rules.PRIORITY_OF_SB[sb]


# ── B-011: all four R_f terms are exposed and reproduce the score ─────────────
@pytest.mark.parametrize(("rain", "month"), [(0, 2), (5, 7), (26.1, 9), (60, 10), (120, 12), (30, 5)])
def test_b011_triggers_reproduce_risk_score(rain, month):
    fl = flood.compute_flood(rain, month)
    t = fl["triggers"]
    assert set(t) == {"currentRainfall", "soilSaturation", "drainageCapacity", "terrainSensitivity"}
    f = PDIM_S1["flood"]
    p = min(t["currentRainfall"] / f["rainRefMmH"], 1)
    r = (
        f["w1"] * p
        + f["w2"] * t["terrainSensitivity"]
        + f["w3"] * t["soilSaturation"]
        - f["w4"] * t["drainageCapacity"]
    )
    # soilSaturation and riskScore are both served at 3 dp.
    assert abs(min(max(r, 0), 1) - fl["riskScore"]) <= 1e-3


# ── alerts: first call, dedupe by type, read -> may re-fire ──────────────────
def test_alert_dedupe_and_refire():
    w, fl, aq = weather(rain=60), flood.compute_flood(60, 10), aqi_payload(250)
    first = rules.new_alerts(w, fl, aq, NOW, active=[])
    assert [a["type"] for a in first] == ["flood", "aqi", "storm", "system"]
    assert len({a["id"] for a in first}) == 4
    later = NOW + timedelta(minutes=5)
    assert rules.new_alerts(w, fl, aq, later, active=first) == []
    read = [{**a, "isRead": True} for a in first]
    again = rules.new_alerts(w, fl, aq, later, active=read)
    assert [a["type"] for a in again] == ["flood", "aqi", "storm"]  # system dedupes even when read
    assert not {a["id"] for a in again} & {a["id"] for a in first}
    assert again[0]["expiresAt"] == "2026-09-23T12:05:00.000Z"


def test_aqi_station_fetch_failure_is_dropped():
    raw = aqi.raw_from_open_meteo({"pm2_5": 20})
    stations = [raw, None] + [raw] * 21
    out = aqi.compute_aqi(raw, stations, None, NOW)
    assert len(out["stations"]) == 22 and out["trend"] == "stable"
    assert out["forecast24h"][0]["hour"] == "2026-09-23T10:00:00.000Z"
    with pytest.raises(ValueError):
        aqi.compute_aqi(None, stations, None, NOW)


def test_mean_effective_temp_is_the_heat_whatif_baseline():
    """B-020: the heat card adds ΔT to mean T_eff (manuscript §4.2), not to air temperature."""
    import json
    from pathlib import Path

    from climate.pdim import heat as heat_mod

    fixture = json.loads((Path(__file__).parents[1] / "fixtures" / "parity.json").read_text(encoding="utf-8"))
    s = next(s for s in fixture["scenarios"] if s["id"] == "dry-heat-polluted")
    raw = s["outputs"]["heat"]
    teff = [h["effectiveTemperature"] for h in raw["hotspots"]]
    got = heat_mod.mean_effective_temp(raw["hotspots"])
    assert min(teff) <= got <= max(teff)
    assert abs(got - sum(teff) / len(teff)) <= 0.05 + 1e-9
    assert got != raw["cityAvgTemp"]  # the air temperature is a different quantity
    assert (
        heat_mod.mean_effective_temp([{"effectiveTemperature": 35.1}, {"effectiveTemperature": 35.2}]) == 35.2
    )
