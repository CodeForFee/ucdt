"""The climate API against a real DB. Snapshots are seeded by the worker's own writer,
`snapshots.store_run`, so they are exactly the S-002 shape the worker stores; the pre-S-002 shape
(legacy `/api/<hazard>` data from tests/fixtures/parity.json) is seeded only to prove it is a 503."""

import json
import re
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest

from climate import snapshots
from climate.api import main
from climate.db import repo
from climate.ingest.names import FORMER_DISTRICTS
from climate.pdim import aqi
from climate.pdim.risk import js_iso
from climate.pdim.simulation import run_counterfactual
from climate.spatial.units import ALL_UNITS

FIXTURE = json.loads((Path(__file__).parents[1] / "fixtures" / "parity.json").read_text(encoding="utf-8"))
SCENARIO = next(s for s in FIXTURE["scenarios"] if s["id"] == "flood-plus-smog")  # 32.7 mm/h, 31 °C, 82 %
LEGACY = next(s for s in FIXTURE["scenarios"] if s["id"] == "rainy-extreme")["outputs"]
LATEST = ("weather", "aqi", "flood", "heat", "recommend")
OLD_SHAPE = {"detail": "no snapshot yet in the current shape"}
ALERT_ID = re.compile(r"^(flood|storm|aqi|heat):[\w-]+:(warning|critical):\d{4}-\d\d-\d\dT\d\d$")


def now() -> datetime:
    return datetime.now(UTC)


async def run(session, at: datetime, pm25: float = 160.0) -> None:
    """One worker run at `at`: every unit gets the fixture weather; CAMS PM2.5 = `pm25` everywhere
    (160 µg/m³ → AQI 210: R-AQI-01 and critical AQI alerts fire); one open-network station."""
    weather = SCENARIO["inputs"]["weather"]
    raw = aqi.raw_from_open_meteo({"pm2_5": pm25, "pm10": 90, "ozone": 40, "nitrogen_dioxide": 20})
    reading = {"id": "ag:42", "name": "Trạm A", "lat": 10.777, "lng": 106.701, "pm25": 35.4}
    reading |= {"observedAt": js_iso(at - timedelta(minutes=20)), "source": "airgradient"}
    await snapshots.store_run(
        session,
        {u["id"]: weather for u in ALL_UNITS} | {"city": weather},
        raw,
        [raw] * 23,
        [reading],
        at,
    )


async def seed_legacy(session, hazard: str, at: datetime) -> None:
    """A pre-S-002 snapshot (what the old compose worker still writes): legacy result, S-001 inputs."""
    await repo.insert_snapshot(session, hazard, at, "pdim-s1", {"seed": True}, LEGACY[hazard])


# ── /v1/<hazard>/latest ──────────────────────────────────────────────────────
@pytest.mark.parametrize("hazard", LATEST)
async def test_latest_serves_the_stored_s002_result_plus_meta(client, session, hazard):
    await run(session, now() - timedelta(hours=2), pm25=5)  # older: never served
    t = now().replace(microsecond=123000)
    await run(session, t)
    stored = (await repo.latest_snapshot(session, hazard))["result"]
    r = await client.get(f"/v1/{hazard}/latest", params={"lat": 1, "lng": 2, "city": "x", "cityId": "y"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.pop("observedAt") == t.strftime("%Y-%m-%dT%H:%M:%S.123Z")
    assert body.pop("stale") is False
    assert body.pop("modelVersion") == "pdim-s1"
    assert body == stored  # served exactly as stored, nothing dropped by the response model


async def test_latest_s002_fields(client, session):
    await run(session, now())
    fl = (await client.get("/v1/flood/latest")).json()
    assert set(fl["triggers"]) == {
        "currentRainfall",
        "terrainSensitivity",
        "imperviousness",
        "drainageCapacity",
    }
    for dec in [fl["decomposition"], *(a["decomposition"] for a in fl["affectedAreas"])]:
        assert [d["key"] for d in dec] == ["rainfall", "terrain", "imperviousness", "drainage"]
        assert dec[3]["contribution"] < 0 < dec[3]["weight"]
    assert fl["affectedAreas"] and all("rainfall" in a for a in fl["affectedAreas"])

    heat = (await client.get("/v1/heat/latest")).json()
    assert set(heat["baselines"]) == {"density", "greenPct"} and "avgEffectiveTemperature" in heat

    aq = (await client.get("/v1/aqi/latest")).json()
    (st,) = aq["observedStations"]
    assert st["id"] == "ag:42" and st["aqi"] == 100 and st["nearestPointId"]

    rec = (await client.get("/v1/recommend/latest")).json()
    assert 0 < len(rec["recommendations"]) <= 10 < rec["firedCount"]
    top = rec["recommendations"][0]
    assert top["id"] == f"{top['ruleId']}:{top['unitId']}"
    assert top["unitKind"] in {"flood_zone", "heat_cell", "aqi_point"}
    assert top["commune"].startswith(("Phường ", "Xã ", "Đặc khu "))
    assert {"severityBand", "exposureE", "feasibilityFa"} <= top["inputs"].keys()


async def test_latest_stale_and_missing(client, session):
    assert (await client.get("/v1/flood/latest")).json() == {"detail": "no snapshot yet"}
    assert (await client.get("/v1/flood/latest")).status_code == 503
    await run(session, now() - timedelta(minutes=46))
    assert (await client.get("/v1/flood/latest")).json()["stale"] is True


@pytest.mark.parametrize("hazard", ["aqi", "flood", "heat", "recommend"])
async def test_old_shape_latest_is_503_not_500(client, session, hazard):
    await run(session, now() - timedelta(minutes=10))
    await seed_legacy(session, hazard, now())  # the stale compose worker wrote the newest row
    r = await client.get(f"/v1/{hazard}/latest")
    assert (r.status_code, r.json()) == (503, OLD_SHAPE)


# ── /v1/alerts ───────────────────────────────────────────────────────────────
async def test_alerts_list_and_mark_read(client, session):
    t = now().replace(microsecond=0)
    row = {"rule_id": "A-FLOOD", "type": "flood", "severity": "warning", "title": "T", "message": "M"}
    exp = t + timedelta(hours=2)
    await repo.insert_alerts(
        session,
        [
            {
                **row,
                "id": "a-old",
                "created_at": t - timedelta(minutes=5),
                "expires_at": t + timedelta(hours=1),
            },
            {**row, "id": "a-warn", "created_at": t, "expires_at": exp, "type": "aqi"},
            {**row, "id": "a-crit", "created_at": t, "expires_at": exp, "severity": "critical"},
            {**row, "id": "a-gone", "created_at": t, "expires_at": t - timedelta(seconds=1)},
            # pre-S-002 always-on system alert: not served (no 500 on the old type either)
            {**row, "id": "a-sys", "created_at": t, "expires_at": exp, "type": "system", "severity": "info"},
        ],
    )
    body = (await client.get("/v1/alerts", params={"lat": 1})).json()
    assert body["unreadCount"] == 3 and body["totalCount"] == 3
    assert [a["id"] for a in body["alerts"]] == ["a-crit", "a-warn", "a-old"]  # newest, then critical
    assert body["alerts"][1] == {
        "id": "a-warn",
        "severity": "warning",
        "type": "aqi",
        "title": "T",
        "message": "M",
        "unitId": None,
        "unitName": None,
        "value": None,
        "isRead": False,
        "createdAt": t.strftime("%Y-%m-%dT%H:%M:%S.000Z"),
        "expiresAt": exp.strftime("%Y-%m-%dT%H:%M:%S.000Z"),
    }

    r = await client.post("/v1/alerts/read", json={"ids": ["a-old", "nope"]})
    assert r.json() == {"marked": 1}
    body = (await client.get("/v1/alerts")).json()
    assert body["unreadCount"] == 2 and body["alerts"][2]["isRead"] is True
    assert (await client.post("/v1/alerts/read", json={"ids": ["a-old"]})).json() == {"marked": 0}


async def test_alerts_from_a_run_are_per_unit(client, session):
    await run(session, now())
    alerts = (await client.get("/v1/alerts")).json()["alerts"]
    assert alerts and all(ALERT_ID.match(a["id"]) for a in alerts)
    assert {a["type"] for a in alerts} >= {"storm", "aqi"}
    sev = [a["severity"] for a in alerts]
    assert sev == sorted(sev, key=lambda s: s != "critical")  # one run: critical first


@pytest.mark.parametrize("body", [{}, {"ids": []}, {"ids": "a"}, {"ids": [1]}])
async def test_mark_read_rejects_bad_body(client, body):
    assert (await client.post("/v1/alerts/read", json=body)).status_code == 422


# ── /v1/simulation ───────────────────────────────────────────────────────────
FROZEN = datetime(2026, 10, 20, 9, 30, tzinfo=UTC)


class Frozen(datetime):
    @classmethod
    def now(cls, tz=None):
        return FROZEN


async def test_simulation_is_the_counterfactual_on_the_latest_snapshots(client, session, monkeypatch):
    await run(session, now())
    snaps = {h: await repo.latest_snapshot(session, h) for h in ("flood", "heat", "aqi")}
    monkeypatch.setattr(main, "datetime", Frozen)
    for sim in LEGACY["simulations"]:
        r = await client.post("/v1/simulation", json=sim["request"])
        assert r.status_code == 200, r.text
        got = r.json()
        assert re.fullmatch(r"sim-\d+-\d+", got["simulationId"])
        scenario = {"urbanDensity": None, **sim["request"]["scenario"]}
        assert got == run_counterfactual(scenario, snaps, FROZEN, simulation_id=got["simulationId"])
        assert got.keys() == {"simulationId", "status", "results", "comparison", "counterfactual"}
        assert got["results"].keys() == {
            "floodRiskDelta",
            "newFloodAreas",
            "tempDelta",
            "aqiDelta",
            "stations",
        }  # affectedBuildings / affectedPopulation removed (B-016)
        assert len(got["results"]["stations"]) == 23
        cf = got["counterfactual"]
        assert cf.keys() == {"recommendations", "firedCount", "alerts", "bandChanges"}
        assert cf["bandChanges"].keys() == {"flood", "heat", "aqi"}


async def test_simulation_rain_scenario_fires_counterfactual(client, session):
    await run(session, now(), pm25=5)
    r = await client.post(
        "/v1/simulation", json={"scenario": {"rainfallIncrease": 100, "trafficReduction": 50}}
    )
    cf = r.json()["counterfactual"]
    assert r.json()["results"]["floodRiskDelta"] > 0
    assert cf["bandChanges"]["flood"] and cf["alerts"]
    assert all(a["unitId"] in a["id"] for a in cf["alerts"])
    assert any(x["ruleId"].startswith("R-FLOOD") for x in cf["recommendations"])


async def test_simulation_defaults_missing_and_old_shape(client, session):
    assert (await client.post("/v1/simulation", json={})).status_code == 503
    for h in ("flood", "heat", "aqi"):
        await seed_legacy(session, h, now() - timedelta(minutes=1))
    r = await client.post("/v1/simulation", json={})
    assert (r.status_code, r.json()) == (503, OLD_SHAPE)

    await run(session, now())
    default = (await client.post("/v1/simulation", json={})).json()
    explicit = await client.post(
        "/v1/simulation",
        json={
            "cityId": None,
            "scenario": {"rainfallIncrease": 50, "rainfallDurationHours": 3, "urbanDensity": None},
        },
    )
    assert default["simulationId"] != explicit.json()["simulationId"]
    assert default["results"] == explicit.json()["results"]


@pytest.mark.parametrize(
    "scenario, msg",
    [
        ({"rainfallIncrease": 501}, "rainfallIncrease must be 0-500"),
        ({"rainfallIncrease": "50"}, "rainfallIncrease must be 0-500"),
        ({"rainfallIncrease": True}, "rainfallIncrease must be 0-500"),
        ({"rainfallDurationHours": -1}, "rainfallDurationHours must be 0-72"),
        (
            {"addGreenCoverage": 100.5},
            "addGreenCoverage must be -100..100 (percentage points relative to baseline)",
        ),
        ({"trafficReduction": 101}, "trafficReduction must be 0-100"),
        ({"urbanDensity": 1.01}, "urbanDensity must be 0-1"),
    ],
)
async def test_simulation_rejects_out_of_bounds_with_legacy_message(client, scenario, msg):
    r = await client.post("/v1/simulation", json={"scenario": scenario})
    assert r.status_code == 422
    assert [e["msg"] for e in r.json()["detail"]] == [msg]


# ── /v1/maturity ─────────────────────────────────────────────────────────────
async def test_maturity(client, session):
    await run(session, now())
    body = (await client.get("/v1/maturity")).json()
    assert (body["windowDays"], body["deltaAqi"]) == (14, 2) and body["evaluatedAt"].endswith("Z")
    by = {h["hazard"]: h for h in body["hazards"]}
    assert by.keys() == {"flood", "heat", "aqi"}
    assert {h["active"] for h in by.values()} == {"S1"}
    s2 = by["aqi"]["stages"]["S2"]
    assert s2["eligible"] is False and s2["reason"]
    assert [(c["name"], c["required"]) for c in s2["criteria"]] == [
        ("consecutiveHourPairs", 168),
        ("spanDays", 7),
    ]
    assert by["aqi"]["s2"] is None and by["flood"]["stages"]["S2"]["reason"]
    assert by["aqi"]["stages"]["S3"]["criteria"][0]["required"] == 12


# ── /v1/history ──────────────────────────────────────────────────────────────
async def test_history(client, session):
    t = now()
    for minutes in (60 * 30, 90, 30):  # 30 h ago falls outside the default 24 h
        await repo.insert_snapshot(
            session, "heat", t - timedelta(minutes=minutes), "pdim-s1", {}, {"m": minutes}
        )
    r = await client.get("/v1/history/heat", params={"lat": 1})
    assert [e["result"] for e in r.json()] == [{"m": 90}, {"m": 30}]
    assert r.json()[0]["computedAt"].endswith("Z")
    assert len((await client.get("/v1/history/heat", params={"hours": 168})).json()) == 3
    assert (await client.get("/v1/history/tsunami")).status_code == 404
    for hours in (0, 169, "x"):
        assert (await client.get("/v1/history/heat", params={"hours": hours})).status_code == 422


async def test_units_serve_the_commune_mapping(client):
    rows = (await client.get("/v1/units")).json()
    assert len(rows) == 63
    assert {r["kind"] for r in rows} == {"flood_zone", "heat_cell", "aqi_point"}
    for r in rows:
        assert r["commune"] is None or r["commune"].startswith(("Phường ", "Xã ", "Đặc khu ")), r
        assert not ADMIN.search(r["name"]) and not FORMER.search(r["name"]), r


async def test_healthz(client):
    r = await client.get("/healthz")
    assert r.status_code == 200 and r.json() == {"status": "ok"}


# ── §A.1 name guard over every API payload ───────────────────────────────────
ADMIN = re.compile(r"\b(Quận|Huyện|District)\b|\bQ\.\s?\d")  # spec §A.1, verbatim
FORMER = re.compile(r"\b(" + "|".join(FORMER_DISTRICTS) + r")\b")


def strings(node, key=None):
    if isinstance(node, dict):
        for k, v in node.items():
            yield from strings(v, k)
    elif isinstance(node, list):
        for v in node:
            yield from strings(v, key)
    elif isinstance(node, str):
        yield key, node


async def test_no_admin_or_former_district_name_in_any_payload(client, session):
    await run(session, now())
    payloads = [(await client.get(f"/v1/{h}/latest")).json() for h in LATEST]
    payloads.append((await client.get("/v1/alerts")).json())
    payloads.append((await client.get("/v1/maturity")).json())
    for scenario in ({}, {"rainfallIncrease": 300, "addGreenCoverage": -30, "urbanDensity": 1}):
        payloads.append((await client.post("/v1/simulation", json={"scenario": scenario})).json())
    found = [(k, s) for p in payloads for k, s in strings(p)]
    communes = [s for k, s in found if k == "commune"]
    assert communes and all(c.startswith(("Phường ", "Xã ", "Đặc khu ")) for c in communes)
    assert [s for k, s in found if ADMIN.search(s)] == []
    assert [s for k, s in found if k != "commune" and FORMER.search(s)] == []
