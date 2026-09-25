"""Algorithm 1 (spec §H) on synthetic station history with KNOWN nowcast coefficients."""

import math
import random
from datetime import datetime, timedelta

import pytest

from climate.pdim import maturity

T0 = datetime.fromisoformat("2026-09-01T00:00:00+00:00")
NOW = T0 + timedelta(days=11)


def history(gw: float, gp: float, days: int = 10, seed: int = 7):
    """One open-network station per day (ag:0 … ag:9, 25 hourly readings each, all mapped to
    station-q1), AQI_{t+1} = AQI_t·exp(−γ_w·W̃_t − γ_p·P̃_t) from 300; two readings per hour (their
    mean is the hourly value) and one aqi snapshot per hour. → 24 pairs a day, 240 over 10 days."""
    rnd = random.Random(seed)
    weather = [
        (rnd.uniform(0, 0.6), rnd.uniform(0.2, 1) if rnd.random() < 0.2 else 0.0)
        for _ in range(days * 24 + 1)
    ]
    inputs = [
        {
            "computed_at": T0 + timedelta(hours=h, minutes=5),
            "pointWeather": {"station-q1": {"windSpeed": w * 30, "rainfall": p * 50}},
            "stationMap": {f"ag:{d}": "station-q1" for d in range(days)},
        }
        for h, (w, p) in enumerate(weather)
    ]
    readings = []
    for d in range(days):
        a = 300.0
        for h in range(d * 24, d * 24 + 25):
            t = T0 + timedelta(hours=h)
            readings += [
                {"location_id": f"ag:{d}", "fetched_at": t + timedelta(minutes=10), "aqi": a - 1},
                {"location_id": f"ag:{d}", "fetched_at": t + timedelta(minutes=40), "aqi": a + 1},
            ]
            w, p = weather[h]
            a *= math.exp(-gw * w - gp * p)
    return readings, inputs


def aqi_of(evaluation):
    return next(h for h in evaluation["hazards"] if h["hazard"] == "aqi")


def test_t_quantile():
    assert maturity.t_quantile_975(10) == pytest.approx(2.228139, abs=2e-3)
    assert maturity.t_quantile_975(120) == pytest.approx(1.979930, abs=1e-5)


def test_ols_recovers_known_coefficients_with_ci():
    rnd = random.Random(1)
    rows = []
    for i in range(200):
        w, p = rnd.uniform(0, 1), rnd.uniform(0, 1)
        y = -0.2 * w - 0.4 * p + rnd.gauss(0, 0.01)
        rows.append((i, "s", 100.0, 100.0 * math.exp(y), w, p))
    fit = maturity.fit_gammas(rows)
    for key, truth in (("gammaWind", 0.2), ("gammaRain", 0.4)):
        lo, hi = fit[key]["ci95"]
        assert lo < truth < hi and hi - lo < 0.02
        assert fit[key]["value"] == pytest.approx(truth, abs=0.01)
    # No rain at all: γ_p is not identifiable.
    assert maturity.fit_gammas([(i, "s", 100.0, 90.0, 0.5, 0.0) for i in range(10)]) is None


def test_too_little_history_stays_s1():
    ev = maturity.evaluate([], [], None, NOW)
    assert [h["active"] for h in ev["hazards"]] == ["S1", "S1", "S1"]
    a = aqi_of(ev)
    assert a["stages"]["S2"]["eligible"] is False and a["s1MaeHoldout"] is None and a["s2"] is None
    assert a["stages"]["S2"]["criteria"][0] == {"name": "consecutiveHourPairs", "current": 0, "required": 168}
    assert maturity.nowcast_gammas(ev) == (maturity.S1, "pdim-s1")
    assert ev["windowDays"] == 14 and ev["deltaAqi"] == 2


def test_promotes_when_s2_beats_s1_by_delta():
    readings, inputs = history(gw=0.01, gp=0.6)
    ev = maturity.evaluate(readings, inputs, T0, NOW)
    a = aqi_of(ev)
    assert a["stages"]["S2"]["eligible"] and a["stages"]["S2"]["criteria"][0]["current"] == 240
    s2 = a["s2"]
    assert s2["estimates"]["gammaRain"]["value"] == pytest.approx(0.6, abs=0.02)
    assert s2["maeHoldout"] <= a["s1MaeHoldout"] - 2 and s2["promoted"]
    assert a["active"] == "S2" and a["modelVersion"] == "pdim-s2-aqi"
    (gw, gp), version = maturity.nowcast_gammas(ev)
    assert version == "pdim-s2-aqi" and gp == s2["estimates"]["gammaRain"]["value"]


def test_demotes_when_s1_is_as_good():
    readings, inputs = history(gw=0.05, gp=0.15)  # the S1 coefficients themselves
    a = aqi_of(maturity.evaluate(readings, inputs, T0, NOW))
    assert a["stages"]["S2"]["eligible"] and a["s2"] is not None and not a["s2"]["promoted"]
    assert a["active"] == "S1"


def test_flood_and_heat_cannot_leave_s1():
    ev = maturity.evaluate([], [], T0 - timedelta(days=400), NOW)
    for h in ev["hazards"][:2]:
        assert h["active"] == "S1" and not h["stages"]["S2"]["eligible"] and h["stages"]["S2"]["reason"]
        assert h["stages"]["S3"]["criteria"][0]["current"] >= 12
