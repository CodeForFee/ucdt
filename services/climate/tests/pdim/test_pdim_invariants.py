"""S-002 per-unit model (spec §B–§G) against HAND-COMPUTED values, where the spec changed the
legacy formulas; plus the regression invariants B-004, B-005, B-008, B-011/B-014.

Catalogue values used below (derived.json): gz-q8-rach-ong z = 6 m, s = 0.3 %, builtUp 0.563678,
localDrain 0.30; gz-q6-binh-tien builtUp 0.949642 → station-q6; station-q6 builtUp 0.954314;
station-q1 v = 7.642 km/km², mean v = 3.719652…; heat ρ₀ = 0.708, G₀ = 21.8 %.
"""

import itertools
from dataclasses import replace
from datetime import datetime

import pytest

from climate.pdim import aqi, flood, heat, rules, simulation
from climate.pdim.constants import PDIM_S1
from climate.pdim.risk import heat_index, js_round
from climate.spatial.catalogue import load_catalogue

NOW = datetime.fromisoformat("2026-09-23T10:00:00Z")  # 17:00 in HCMC
CAT = load_catalogue()
ZONES = [z.id for z in CAT.flood_zones]


def values(flood_=None, aqi_=None, heat_=None):
    return {"flood": flood_ or {}, "aqi": aqi_ or {}, "heat": heat_ or {}}


# ── §B flood: per-zone R_f and its decomposition (B-011, B-014) ─────────────────
def test_zone_score_hand_computed():
    fl = flood.compute_flood({z: 20 for z in ZONES}, 20, CAT)
    area = next(a for a in fl["affectedAreas"] if a["id"] == "gz-q8-rach-ong")
    # P̃ = 20/50 = 0.4; T̃ = ½(1 − 6/10) + ½(1 − 0.3/2) = 0.625; Ĩ = 0.563678; D̃ = 0.30
    # R_f = 0.45·0.4 + 0.30·0.625 + 0.25·0.563678 − 0.15·0.30 = 0.4634195
    dec = {d["key"]: d for d in area["decomposition"]}
    assert [d["key"] for d in area["decomposition"]] == ["rainfall", "terrain", "imperviousness", "drainage"]
    assert dec["rainfall"]["normalized"] == pytest.approx(0.4)
    assert dec["terrain"]["normalized"] == pytest.approx(0.625)
    assert dec["imperviousness"]["normalized"] == pytest.approx(0.563678)
    assert dec["drainage"] == pytest.approx(
        {"key": "drainage", "weight": 0.15, "normalized": 0.30, "contribution": -0.045}
    )
    assert area["riskScore"] == 0.463 and area["riskLevel"] == "medium" and area["estimatedDepth"] == 0.37
    assert area["rainfall"] == 20


@pytest.mark.parametrize("rain", [0, 5, 26.1, 45, 120])
def test_decomposition_sums_to_the_score_city_and_zones(rain):
    fl = flood.compute_flood({z: rain for z in ZONES}, rain, CAT)
    for dec, served in [(fl["decomposition"], fl["riskScore"])] + [
        (a["decomposition"], a["riskScore"]) for a in fl["affectedAreas"]
    ]:
        total = sum(d["contribution"] for d in dec)
        assert js_round(min(max(total, 0), 1) * 1000) / 1000 == served
        for d in dec:
            sign = -1 if d["key"] == "drainage" else 1
            assert d["contribution"] == pytest.approx(sign * d["weight"] * d["normalized"])
    t = fl["triggers"]
    assert set(t) == {"currentRainfall", "terrainSensitivity", "imperviousness", "drainageCapacity"}
    # City T̃, Ĩ, D̃ are the means over the 18 zones.
    mean_drain = sum(z.local_drain for z in CAT.flood_zones) / 18
    assert t["drainageCapacity"] == pytest.approx(mean_drain, abs=5e-4)
    assert t["imperviousness"] == pytest.approx(sum(z.built_up for z in CAT.flood_zones) / 18, abs=5e-4)
    assert all(a["riskScore"] >= 0.15 for a in fl["affectedAreas"])


def test_zones_scored_from_their_own_rain():
    rain = {z: 0 for z in ZONES} | {"gz-q8-rach-ong": 50}
    fl = flood.compute_flood(rain, 0, CAT)
    by_id = {a["id"]: a for a in fl["affectedAreas"]}
    assert by_id["gz-q8-rach-ong"]["riskScore"] == pytest.approx(0.4634195 + 0.45 * 0.6, abs=5e-4)
    assert by_id["gz-q8-kinh-doi"]["rainfall"] == 0


# ── §C heat ───────────────────────────────────────────────────────────────────
def test_heat_per_cell_hand_computed_and_baselines():
    cur = {c.id: {"temperature": 30, "humidity": 60} for c in CAT.heat_cells}
    cur["q1"] = {"temperature": 35, "humidity": 70}
    out = heat.compute_heat(cur, {"temperature": 31.2, "humidity": 65}, NOW, CAT)
    q1 = next(h for h in out["hotspots"] if h["id"] == "q1")
    assert q1["temperature"] == js_round((heat_index(35, 70) + 3.5 * 0.725231) * 10) / 10
    assert q1["intensity"] == 0.725231
    assert out["avgTemperature"] == 31.2  # city-centre air temperature
    assert out["maxTemperature"] == max(h["temperature"] for h in out["hotspots"])
    assert out["baselines"] == {"density": 0.708, "greenPct": 21.8}


# ── §E rule base ──────────────────────────────────────────────────────────────
def test_rules_per_unit_hand_computed():
    v = values(
        {"gz-q6-binh-tien": {"riskScore": 0.8, "rainfall": 45}},
        {"station-q6": 160},
    )
    out = rules.recommendations(v, CAT, NOW)
    got = {r["id"]: r["priorityScore"] for r in out["recommendations"]}
    # π = S·E·F: 4·0.949642·0.95 = 3.609, 4·0.949642·0.9 = 3.419, 3·0.954314·0.9 = 2.577
    assert got == {
        "R-COMB-01:gz-q6-binh-tien": 3.61,
        "R-FLOOD-01:gz-q6-binh-tien": 3.42,
        "R-AQI-02:station-q6": 2.58,
    }
    assert list(got) == ["R-COMB-01:gz-q6-binh-tien", "R-FLOOD-01:gz-q6-binh-tien", "R-AQI-02:station-q6"]
    comb = out["recommendations"][0]
    assert comb["unitKind"] == "flood_zone" and comb["unitName"] == "Bình Tiên"
    assert comb["commune"] == "Phường Phú Lâm" and "Bình Tiên" in comb["message"]
    assert comb["inputs"] == {
        "riskScore": 0.8,
        "aqi": 160,
        "aqiPointId": "station-q6",
        "severityBand": "combined_hazard",
        "exposureE": 0.949642,
        "feasibilityFa": 0.95,
    }
    assert out["firedCount"] == 3 and out["overallRiskLevel"] == "critical"


def test_rain_gate_and_else_chain():
    # R_f > 0.75 but P ≤ 40 → R-FLOOD-02 (the else branch), not 01.
    out = rules.recommendations(values({"gz-q8-rach-ong": {"riskScore": 0.8, "rainfall": 40}}), CAT, NOW)
    assert [r["ruleId"] for r in out["recommendations"]] == ["R-FLOOD-02"]


def test_exposure_is_clamped_built_up():
    q1 = next(c for c in CAT.heat_cells if c.id == "q1")
    cat = replace(CAT, heat_cells=(replace(q1, built_up=0.05),))
    (r,) = rules.recommendations(values(heat_={"q1": 41}), cat, NOW)["recommendations"]
    assert r["inputs"]["exposureE"] == 0.1 and r["priorityScore"] == js_round(4 * 0.1 * 0.85 * 100) / 100


def test_top_k_and_fired_count():
    v = values(aqi_={p.id: 250 for p in CAT.aqi_points})
    out = rules.recommendations(v, CAT, NOW)
    assert len(out["recommendations"]) == 10 and out["firedCount"] == 23
    keys = [(-r["priorityScore"], r["ruleId"], r["unitName"]) for r in out["recommendations"]]
    assert keys == sorted(keys)


def test_norm_default():
    out = rules.recommendations(values(), CAT, NOW)
    (r,) = out["recommendations"]
    assert r["ruleId"] == "R-NORM-00" and r["priorityScore"] == 0 and out["firedCount"] == 0
    assert out["overallRiskLevel"] == "low"


def _grid():
    for score, rain, a, t in itertools.product(
        (0.1, 0.3, 0.6, 0.8), (10, 50), (50, 120, 170, 250), (30, 38, 41)
    ):
        v = values(
            {z: {"riskScore": score, "rainfall": rain} for z in ZONES},
            {p.id: a for p in CAT.aqi_points},
            {c.id: t for c in CAT.heat_cells},
        )
        yield rules.recommendations(v, CAT, NOW, k=1000)


GRID = list(_grid())
SB_OF = {"urgent": 4, "high": 3, "medium": 2}


def test_grid_fires_every_rule():
    fired = {r["ruleId"] for res in GRID for r in res["recommendations"]}
    expected = {f"R-FLOOD-0{i}" for i in (1, 2, 3)} | {f"R-AQI-0{i}" for i in (1, 2, 3)}
    assert fired == expected | {"R-HEAT-01", "R-HEAT-02", "R-COMB-01", "R-NORM-00"}


def test_b005_b008_traceable_uniform_priority():
    for res in GRID:
        recs = res["recommendations"]
        if recs[0]["ruleId"] == "R-NORM-00":
            assert len(recs) == 1 and res["overallRiskLevel"] == "low"
            continue
        assert res["firedCount"] == len(recs)
        for r in recs:
            sb = SB_OF[r["priority"]]
            e, fa = r["inputs"]["exposureE"], r["inputs"]["feasibilityFa"]
            assert r["id"] == f"{r['ruleId']}:{r['unitId']}" and r["actionItems"]
            assert r["priorityScore"] == js_round(sb * e * fa * 100) / 100 > 0
            assert r["priority"] == rules.PRIORITY_OF_SB[sb]


# ── §F alerts: band rises per unit ────────────────────────────────────────────
def test_band_rise_alerts():
    now = values(
        {
            "gz-q8-rach-ong": {"riskScore": 0.6, "rainfall": 35},
            "gz-q8-kinh-doi": {"riskScore": 0.8, "rainfall": 55},
        },
        {"station-q1": 210},
        {"q1": 38},
    )
    got = {a["id"]: a for a in rules.band_alerts(now, values(), CAT, NOW)}
    exp = {  # id -> hours to expiry
        "flood:gz-q8-rach-ong:warning:2026-09-23T17": 3,
        "flood:gz-q8-kinh-doi:critical:2026-09-23T17": 2,
        "storm:gz-q8-rach-ong:warning:2026-09-23T17": 1,
        "storm:gz-q8-kinh-doi:critical:2026-09-23T17": 1,
        "aqi:station-q1:critical:2026-09-23T17": 4,
        "heat:q1:warning:2026-09-23T17": 6,
    }
    assert set(got) == set(exp)
    for i, h in exp.items():
        assert got[i]["expiresAt"] == f"2026-09-23T{10 + h:02d}:00:00.000Z", i
    assert "Rạch Ông" in got["flood:gz-q8-rach-ong:warning:2026-09-23T17"]["message"]
    assert all(a["type"] != "system" for a in got.values())


def test_band_alerts_only_on_a_rise():
    def flood_at(score):
        return values({"gz-q8-rach-ong": {"riskScore": score, "rainfall": 0}})

    assert rules.band_alerts(flood_at(0.6), flood_at(0.55), CAT, NOW) == []  # same band
    assert rules.band_alerts(flood_at(0.6), flood_at(0.8), CAT, NOW) == []  # fell
    (a,) = rules.band_alerts(flood_at(0.8), flood_at(0.6), CAT, NOW)  # warning → critical
    assert a["severity"] == "critical"
    assert rules.band_alerts(flood_at(0.5), values(), CAT, NOW) == []  # 0.50 is not > 0.50


# ── §G counterfactual ─────────────────────────────────────────────────────────
def _snaps(rain=0.0, pm25=20.0):
    cur = {"temperature": 28, "humidity": 60, "rainfall": rain, "windSpeed": 10}  # T_eff < 37 °C
    zones = {z: rain for z in ZONES}
    raw = aqi.raw_from_open_meteo({"pm2_5": pm25})
    points = {u: {"rainfall": rain, "windSpeed": 10} for u in [*(p.id for p in CAT.aqi_points), "city"]}
    return {
        "flood": {
            "inputs": {"rainfall": zones, "cityRainfall": rain},
            "result": flood.compute_flood(zones, rain, CAT),
        },
        "heat": {
            "inputs": {},
            "result": heat.compute_heat({c.id: cur for c in CAT.heat_cells}, cur, NOW, CAT),
        },
        "aqi": {
            "inputs": {"pointWeather": points},
            "result": aqi.compute_aqi(raw, [raw] * 23, [], NOW, cat=CAT),
        },
    }


BASE = {"rainfallIncrease": 0, "rainfallDurationHours": 0, "addGreenCoverage": 0, "trafficReduction": 0}


def cf(snaps, **over):
    return simulation.run_counterfactual({**BASE, **over}, snaps, NOW, CAT)


def test_neutral_scenario_changes_nothing():
    snaps = _snaps(rain=10)
    out = cf(snaps)
    r = out["results"]
    assert (r["floodRiskDelta"], r["tempDelta"], r["aqiDelta"]) == (0, 0, 0)
    assert all(s["delta"] == 0 for s in r["stations"])
    assert out["counterfactual"]["alerts"] == []
    assert out["counterfactual"]["bandChanges"] == {"flood": [], "heat": [], "aqi": []}
    v = rules.unit_values(snaps["flood"]["result"], snaps["aqi"]["result"], snaps["heat"]["result"])
    assert out["counterfactual"]["recommendations"] == rules.recommendations(v, CAT, NOW)["recommendations"]
    assert "affectedBuildings" not in r and "affectedPopulation" not in r


def test_dry_day_rain_scenario_uses_the_reference_shower():
    out = cf(_snaps(rain=0), rainfallIncrease=100)  # P_sim = 20·2 = 40 mm/h everywhere
    area = next(a for a in out["results"]["newFloodAreas"] if a["id"] == "gz-q8-rach-ong")
    assert area["rainfall"] == 40 and area["geojson"]["properties"]["simulated"] is True
    # 0.4634195 − 0.45·0.4 + 0.45·0.8 = 0.6434195 → band high; storm P 40 > 30 would fire
    assert area["riskScore"] == 0.643
    ids = {a["id"] for a in out["counterfactual"]["alerts"]}
    assert "flood:gz-q8-rach-ong:warning:2026-09-23T17" in ids
    assert "storm:gz-q8-rach-ong:warning:2026-09-23T17" in ids
    change = next(c for c in out["counterfactual"]["bandChanges"]["flood"] if c["unitId"] == "gz-q8-rach-ong")
    # before: 0.4634195 − 0.45·0.4 = 0.2834195 → medium
    assert change == {"unitId": "gz-q8-rach-ong", "name": "Rạch Ông", "before": "medium", "after": "high"}
    # Step 6 on the counterfactual state: P = 40 is not > 40, so R-FLOOD-01 cannot fire.
    areas = out["results"]["newFloodAreas"]
    assert out["counterfactual"]["firedCount"] == sum(a["riskScore"] > 0.25 for a in areas)
    assert {r["ruleId"] for r in out["counterfactual"]["recommendations"]} == {"R-FLOOD-02"}


def test_green_raises_drainage_and_cools():
    out = cf(_snaps(rain=20), addGreenCoverage=10)
    area = next(a for a in out["results"]["newFloodAreas"] if a["id"] == "gz-q8-rach-ong")
    dec = {d["key"]: d for d in area["decomposition"]}
    assert dec["drainage"]["normalized"] == pytest.approx(0.30 + 10 * 0.003)
    assert out["results"]["tempDelta"] == -1.5  # −α·ΔG = −0.15·10


def test_b004_urban_density_moves_temp_delta():
    snaps = _snaps()
    assert cf(snaps, urbanDensity=0.9)["results"]["tempDelta"] == pytest.approx(0.7)  # 3.5·(0.9 − 0.708)
    assert cf(snaps, urbanDensity=0.3)["results"]["tempDelta"] < 0
    assert cf(snaps, urbanDensity=0.708)["results"]["tempDelta"] == 0  # the served ρ₀


def test_traffic_scales_with_road_density():
    out = cf(_snaps(pm25=35.4), trafficReduction=20)  # AQI 100 at every point
    q1 = next(s for s in out["results"]["stations"] if s["id"] == "station-q1")
    v_mean = sum(p.road_density for p in CAT.aqi_points) / 23
    assert q1 == {
        "id": "station-q1",
        "name": "Bến Nghé",
        "before": 100,
        "after": js_round(100 - 0.3 * 20 * 7.642 / v_mean),
        "delta": js_round(100 - 0.3 * 20 * 7.642 / v_mean) - 100,
    }
    assert out["results"]["aqiDelta"] == -6.0  # city: ṽ = 1


# ── misc ──────────────────────────────────────────────────────────────────────
def test_aqi_station_fetch_failure_is_dropped():
    raw = aqi.raw_from_open_meteo({"pm2_5": 20})
    stations = [raw, None] + [raw] * 21
    out = aqi.compute_aqi(raw, stations, None, NOW)
    assert len(out["stations"]) == 22 and out["trend"] == "stable"
    assert out["forecast24h"][0]["hour"] == "2026-09-23T10:00:00.000Z"
    with pytest.raises(ValueError):
        aqi.compute_aqi(None, stations, None, NOW)


def test_observed_stations_map_to_nearest_point():
    reading = {
        "id": "ag:1",
        "name": "Trạm AirGradient 1",
        "lat": 10.7771,
        "lng": 106.7011,
        "pm25": 35.4,
        "observedAt": "2026-09-23T09:50:00.000Z",
        "source": "airgradient",
    }
    (s,) = aqi.observed_stations([reading], CAT)
    assert s["aqi"] == 100 and s["nearestPointId"] == "station-q1"


def test_fitted_gammas_drive_the_nowcast():
    fc = [{"windSpeed": 30, "rainfall": 50}] * 24
    s1 = aqi.build_nowcast_24h(100, fc, NOW)
    s2 = aqi.build_nowcast_24h(100, fc, NOW, (0.0, 0.0))
    assert s1[1]["aqi"] == js_round(100 * 0.95 * 0.85) and all(x["aqi"] == 100 for x in s2)
    assert PDIM_S1["aqi"]["gammaWind"] == 0.05


def test_mean_effective_temp():
    assert heat.mean_effective_temp([35.1, 35.2]) == 35.2
