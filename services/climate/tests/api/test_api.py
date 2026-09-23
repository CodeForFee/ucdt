"""The climate API against a real DB. Snapshots are seeded with the cross-seam contract shape
(result = legacy `/api/<hazard>` data, taken from tests/fixtures/parity.json)."""

import json
import re
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest

from climate.db import repo
from climate.pdim.simulation import run_simulation

FIXTURE = json.loads((Path(__file__).parents[1] / "fixtures" / "parity.json").read_text(encoding="utf-8"))
SCENARIO = next(s for s in FIXTURE["scenarios"] if s["id"] == "rainy-extreme")


def heat_controller_shape(raw: dict) -> dict:
    """Legacy heatController's transform of heat.service output (what /api/heat returned)."""
    return {
        "city": "hcmc",
        "timestamp": raw["timestamp"],
        "avgTemperature": raw["cityAvgTemp"],
        "maxTemperature": raw["cityMaxEffectiveTemp"],
        "heatIslandIntensity": raw["uhiEffect"],
        "hotspots": [
            {k: h[k] for k in ("id", "name", "lat", "lng")}
            | {"temperature": h["effectiveTemperature"], "intensity": h["urbanDensity"]}
            for h in raw["hotspots"]
        ],
        "geojson": {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "geometry": {"type": "Point", "coordinates": [h["lng"], h["lat"]]},
                    "properties": {"temperature": h["effectiveTemperature"], "intensity": h["urbanDensity"]},
                }
                for h in raw["hotspots"]
            ],
        },
    }


RESULTS = {
    "weather": SCENARIO["inputs"]["weather"],
    "aqi": SCENARIO["outputs"]["aqi"],
    "flood": SCENARIO["outputs"]["flood"],
    "heat": heat_controller_shape(SCENARIO["outputs"]["heat"]),
    "recommend": SCENARIO["outputs"]["recommend"],
}
HAZARDS = list(RESULTS)


def now() -> datetime:
    return datetime.now(UTC)


async def seed(session, hazard: str, computed_at: datetime, result=None) -> None:
    await repo.insert_snapshot(
        session, hazard, computed_at, "pdim-s1", {"seed": True}, RESULTS[hazard] if result is None else result
    )


@pytest.mark.parametrize("hazard", HAZARDS)
async def test_latest_returns_stored_result_plus_meta(client, session, hazard):
    await seed(session, hazard, now() - timedelta(hours=2), {"old": True})  # stale, older: never served
    t = now().replace(microsecond=123000)
    await seed(session, hazard, t)
    r = await client.get(f"/v1/{hazard}/latest", params={"lat": 1, "lng": 2, "city": "x", "cityId": "y"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.pop("observedAt") == t.strftime("%Y-%m-%dT%H:%M:%S.123Z")
    assert body.pop("stale") is False
    assert body == RESULTS[hazard]  # served exactly as stored, nothing dropped by the response model


async def test_latest_stale_and_missing(client, session):
    assert (await client.get("/v1/flood/latest")).json() == {"detail": "no snapshot yet"}
    assert (await client.get("/v1/flood/latest")).status_code == 503
    await seed(session, "flood", now() - timedelta(minutes=46))
    assert (await client.get("/v1/flood/latest")).json()["stale"] is True


async def test_alerts_list_and_mark_read(client, session):
    t = now().replace(microsecond=0)
    row = {"rule_id": "R", "type": "flood", "severity": "critical", "title": "T", "message": "M"}
    await repo.insert_alerts(
        session,
        [
            {
                **row,
                "id": "a-old",
                "created_at": t - timedelta(minutes=5),
                "expires_at": t + timedelta(hours=1),
            },
            {**row, "id": "a-new", "created_at": t, "expires_at": t + timedelta(hours=2), "type": "aqi"},
            {**row, "id": "a-gone", "created_at": t, "expires_at": t - timedelta(seconds=1)},
        ],
    )
    body = (await client.get("/v1/alerts", params={"lat": 1})).json()
    assert body["unreadCount"] == 2 and body["totalCount"] == 2
    assert body["alerts"][0] == {
        "id": "a-new",
        "severity": "critical",
        "type": "aqi",
        "title": "T",
        "message": "M",
        "isRead": False,
        "createdAt": t.strftime("%Y-%m-%dT%H:%M:%S.000Z"),
        "expiresAt": (t + timedelta(hours=2)).strftime("%Y-%m-%dT%H:%M:%S.000Z"),
    }
    assert [a["id"] for a in body["alerts"]] == ["a-new", "a-old"]

    r = await client.post("/v1/alerts/read", json={"ids": ["a-old", "nope"]})
    assert r.json() == {"marked": 1}
    body = (await client.get("/v1/alerts")).json()
    assert body["unreadCount"] == 1 and body["alerts"][1]["isRead"] is True
    assert (await client.post("/v1/alerts/read", json={"ids": ["a-old"]})).json() == {"marked": 0}


@pytest.mark.parametrize("body", [{}, {"ids": []}, {"ids": "a"}, {"ids": [1]}])
async def test_mark_read_rejects_bad_body(client, body):
    assert (await client.post("/v1/alerts/read", json=body)).status_code == 422


async def seed_sim_baseline(session):
    for h in ("weather", "flood", "aqi"):
        await seed(session, h, now())


async def test_simulation_runs_pdim_on_latest_snapshots(client, session):
    # PDIM == legacy is proven by tests/pdim/test_pdim_parity.py (1e-9); here: the API feeds it the
    # latest weather/flood/aqi snapshots and serves its output unchanged.
    await seed_sim_baseline(session)
    for sim in SCENARIO["outputs"]["simulations"]:
        r = await client.post("/v1/simulation", json=sim["request"])
        assert r.status_code == 200, r.text
        got = r.json()
        want = run_simulation(
            sim["request"]["scenario"],
            RESULTS["weather"],
            RESULTS["flood"],
            RESULTS["aqi"],
            now(),
            got["simulationId"],
        )
        assert re.fullmatch(r"sim-\d+-\d+", got["simulationId"])
        assert got == want
        assert got.keys() == sim["result"].keys()


async def test_simulation_defaults_and_missing_baseline(client, session):
    assert (await client.post("/v1/simulation", json={})).status_code == 503
    await seed_sim_baseline(session)
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


async def test_history(client, session):
    t = now()
    for minutes in (60 * 30, 90, 30):  # 30 h ago falls outside the default 24 h
        await seed(session, "heat", t - timedelta(minutes=minutes), {"m": minutes})
    r = await client.get("/v1/history/heat", params={"lat": 1})
    assert [e["result"] for e in r.json()] == [{"m": 90}, {"m": 30}]
    assert r.json()[0]["computedAt"].endswith("Z")
    assert len((await client.get("/v1/history/heat", params={"hours": 168})).json()) == 3
    assert (await client.get("/v1/history/tsunami")).status_code == 404
    for hours in (0, 169, "x"):
        assert (await client.get("/v1/history/heat", params={"hours": hours})).status_code == 422


async def test_healthz(client):
    r = await client.get("/healthz")
    assert r.status_code == 200 and r.json() == {"status": "ok"}
