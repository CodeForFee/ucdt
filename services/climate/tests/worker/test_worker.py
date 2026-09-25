import copy
import json
import math
import re
from datetime import datetime, timedelta
from pathlib import Path

import httpx
import pytest
import respx
from sqlalchemy import text

from climate.ingest import air, airgradient, weather
from climate.snapshots import ALERT_SNAPSHOT, HAZARDS
from climate.spatial.catalogue import load_catalogue
from climate.worker import main

FIXTURE = json.loads((Path(__file__).parents[1] / "fixtures" / "parity.json").read_text(encoding="utf-8"))
SCENARIO = next(s for s in FIXTURE["scenarios"] if s["id"] == "flood-plus-smog")  # city rain 32.7 mm/h
NOW = datetime.fromisoformat(SCENARIO["now"])
CAT = load_catalogue()
WET = next(z for z in CAT.flood_zones if z.id == "gz-q8-rach-ong")  # gets 60 mm/h at its own coordinate
ALERT_ID = re.compile(r"^(flood|storm|aqi|heat):[\w-]+:(warning|critical):2026-10-20T16$")  # 09Z = 16 local


class Frozen(datetime):
    @classmethod
    def now(cls, tz=None):
        return NOW


class FakeRedis:
    """Records each publish together with how many snapshots a NEW connection can see then."""

    def __init__(self, sm):
        self.sm, self.published = sm, []

    async def publish(self, channel, message):
        async with self.sm() as s:
            visible = await s.scalar(text("SELECT count(*) FROM risk_snapshots"))
        self.published.append((channel, json.loads(message), visible))


def mock_upstream(forecast_status=200, aq_status=200):
    # utc_offset 0 makes the fixture's hourly series line up with NOW (as in legacy).
    base = {**SCENARIO["inputs"]["openMeteoForecast"], "utc_offset_seconds": 0}
    wet = copy.deepcopy(base)
    wet["hourly"]["precipitation"] = [60] * len(wet["hourly"]["time"])

    def forecast_reply(request):
        p = request.url.params
        coords = zip(p["latitude"].split(","), p["longitude"].split(","), strict=True)
        body = [wet if (float(la), float(lo)) == (WET.lat, WET.lng) else base for la, lo in coords]
        return httpx.Response(forecast_status, json=body)

    respx.get(weather.FORECAST_URL).mock(side_effect=forecast_reply)
    aq = SCENARIO["inputs"]["airQuality"]

    def aq_reply(request):
        p = request.url.params
        current = aq.get(f"{float(p['latitude'])!r},{float(p['longitude'])!r}")
        return httpx.Response(aq_status if current else 500, json={"current": current})

    respx.get(air.OPEN_METEO_AQ_URL).mock(side_effect=aq_reply)
    fresh = (NOW - timedelta(minutes=20)).isoformat()
    respx.get(airgradient.AIRGRADIENT_URL).respond(
        json=[
            {"locationId": 42, "publicLocationName": "Trạm A", "latitude": 10.777, "longitude": 106.701}
            | {"pm02": 35.4, "timestamp": fresh},
            {"locationId": 43, "publicLocationName": "Trạm B", "latitude": 10.8, "longitude": 106.7}
            | {"pm02": 20, "timestamp": (NOW - timedelta(hours=3)).isoformat()},  # > 2 h old: dropped
        ]
    )


@pytest.fixture
async def ctx(sessionmaker, monkeypatch):
    monkeypatch.setattr(main, "datetime", Frozen)
    async with httpx.AsyncClient() as http:
        yield {"http": http, "sessionmaker": sessionmaker, "redis": FakeRedis(sessionmaker)}


@respx.mock
async def test_ingest_scores_per_unit_then_publishes(ctx):
    mock_upstream()
    assert await main.ingest(ctx) == "ok"

    async with ctx["sessionmaker"]() as s:
        rows = (
            await s.execute(text("SELECT id, hazard, model_version, inputs, result FROM risk_snapshots"))
        ).all()
        alerts = (await s.execute(text("SELECT id, type, severity, snapshot_id, rule_id FROM alerts"))).all()
        obs = (await s.execute(text("SELECT location_id, source, aqi, fetched_at FROM aqi_obs"))).all()
    snaps = {r.hazard: r for r in rows}
    assert sorted(snaps) == sorted(HAZARDS) and len(rows) == 5
    assert {r.model_version for r in rows} == {"pdim-s1"}  # no station history yet: Algorithm 1 keeps S1

    # §B: each zone scored from the weather at its own coordinate; decomposition sums to R_f.
    fl = snaps["flood"].result
    by_id = {a["id"]: a for a in fl["affectedAreas"]}
    assert by_id[WET.id]["rainfall"] == 60 and by_id["gz-q8-kinh-doi"]["rainfall"] == 32.7
    assert snaps["flood"].inputs["rainfall"][WET.id] == 60 and snaps["flood"].inputs["cityRainfall"] == 32.7
    for dec, served in [(fl["decomposition"], fl["riskScore"])] + [
        (a["decomposition"], a["riskScore"]) for a in fl["affectedAreas"]
    ]:
        assert math.floor(min(max(sum(d["contribution"] for d in dec), 0), 1) * 1000 + 0.5) / 1000 == served
    assert set(fl["triggers"]) == {
        "currentRainfall",
        "terrainSensitivity",
        "imperviousness",
        "drainageCapacity",
    }

    # §C, §D, §E payloads.
    assert snaps["heat"].result["baselines"] == {"density": 0.708, "greenPct": 21.8}
    (station,) = snaps["aqi"].result["observedStations"]
    assert station["id"] == "ag:42" and station["aqi"] == 100 and station["nearestPointId"] == "station-q1"
    assert snaps["aqi"].inputs["stationMap"] == {"ag:42": "station-q1"}
    rec = snaps["recommend"].result
    assert 0 < len(rec["recommendations"]) <= 10 <= rec["firedCount"]
    assert set(rec["recommendations"][0]) >= {
        "id",
        "ruleId",
        "unitId",
        "unitName",
        "unitKind",
        "commune",
        "inputs",
    }

    # §I.3: the open-network reading is stored at its observation time as ag:<id>.
    ag = [o for o in obs if o.source == "airgradient"]
    assert [(o.location_id, o.aqi, o.fetched_at) for o in ag] == [("ag:42", 100, NOW - timedelta(minutes=20))]
    assert len(obs) == 24 + 1  # city + 23 CAMS points + 1 station

    # §F: per-unit band rises vs no previous snapshot; the wet zone crosses the storm threshold.
    ids = {a.id for a in alerts}
    assert all(ALERT_ID.match(i) for i in ids), ids
    assert (
        f"storm:{WET.id}:critical:2026-10-20T16" in ids
        and "storm:gz-q8-kinh-doi:warning:2026-10-20T16" in ids
    )
    by_snap = {r.id: r.hazard for r in rows}
    for a in alerts:
        assert a.rule_id == f"A-{a.type.upper()}" and by_snap[a.snapshot_id] == ALERT_SNAPSHOT[a.type]
    assert "system" not in {a.type for a in alerts}

    pub = ctx["redis"].published
    assert {ch for ch, _, _ in pub} == {"ucdt:events"}
    assert all(visible == 5 for _, _, visible in pub)  # every event sent after commit
    assert [e for _, e, _ in pub][:5] == [{"type": "snapshot.updated", "hazard": h} for h in HAZARDS]
    assert {e["id"] for _, e, _ in pub[5:]} == ids

    # Second run, same weather: no band rose, so only snapshot events go out.
    ctx["redis"].published.clear()
    assert await main.ingest(ctx) == "ok"
    assert [e["type"] for _, e, _ in ctx["redis"].published] == ["snapshot.updated"] * 5


@respx.mock
@pytest.mark.parametrize("forecast_status,aq_status", [(503, 200), (200, 500)])
async def test_failed_upstream_skips_the_whole_run(ctx, forecast_status, aq_status):
    mock_upstream(forecast_status, aq_status)
    assert await main.ingest(ctx) == "skipped"
    async with ctx["sessionmaker"]() as s:
        for table in ("risk_snapshots", "alerts", "weather_obs", "aqi_obs"):
            assert await s.scalar(text(f"SELECT count(*) FROM {table}")) == 0, table
    assert ctx["redis"].published == []


def test_cron_runs_every_interval_and_at_startup():
    (job,) = main.WorkerSettings.cron_jobs
    assert job.run_at_startup and job.minute == {0, 15, 30, 45}
