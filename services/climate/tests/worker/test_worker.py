import json
import math
from datetime import datetime
from pathlib import Path

import httpx
import pytest
import respx
from sqlalchemy import text

from climate.ingest import air, weather
from climate.snapshots import ALERT_SNAPSHOT, HAZARDS
from climate.spatial.units import HEAT_CELLS
from climate.worker import main


def expected_mean_teff(raw_heat: dict) -> float:
    """Independent of climate.pdim.heat: mean of the served 1-decimal cell T_eff, rounded
    to 1 decimal like JS Math.round (floor(x + 0.5))."""
    import math

    temps = [h["effectiveTemperature"] for h in raw_heat["hotspots"]]
    return math.floor(sum(temps) / len(temps) * 10 + 0.5) / 10


FIXTURE = json.loads((Path(__file__).parents[1] / "fixtures" / "parity.json").read_text(encoding="utf-8"))
SCENARIO = next(s for s in FIXTURE["scenarios"] if s["id"] == "flood-plus-smog")
NOW = datetime.fromisoformat(SCENARIO["now"])
HEAT_NAMES = {c["id"]: c["name"] for c in HEAT_CELLS}  # S-002 §A.1; parity.json keeps legacy names


def same(a, b):
    """Legacy payload equality: numbers within 1e-9 (as tests/pdim), everything else exact."""
    if isinstance(b, dict):
        return isinstance(a, dict) and a.keys() == b.keys() and all(same(a[k], b[k]) for k in b)
    if isinstance(b, list):
        return isinstance(a, list) and len(a) == len(b) and all(map(same, a, b))
    if isinstance(b, int | float) and not isinstance(b, bool):
        return isinstance(a, int | float) and math.isclose(a, b, rel_tol=0, abs_tol=1e-9)
    return a == b


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
    # utc_offset 0 reproduces legacy's hour pick, so every result must equal the legacy payload.
    forecast = {**SCENARIO["inputs"]["openMeteoForecast"], "utc_offset_seconds": 0}
    respx.get(weather.FORECAST_URL).respond(forecast_status, json=forecast)
    aq = SCENARIO["inputs"]["airQuality"]

    def aq_reply(request):
        p = request.url.params
        current = aq.get(f"{float(p['latitude'])!r},{float(p['longitude'])!r}")
        return httpx.Response(aq_status if current else 500, json={"current": current})

    respx.get(air.OPEN_METEO_AQ_URL).mock(side_effect=aq_reply)


@pytest.fixture
async def ctx(sessionmaker, monkeypatch):
    monkeypatch.setattr(main, "datetime", Frozen)
    async with httpx.AsyncClient() as http:
        yield {"http": http, "sessionmaker": sessionmaker, "redis": FakeRedis(sessionmaker)}


@respx.mock
async def test_ingest_writes_legacy_payloads_then_publishes(ctx):
    mock_upstream()
    assert await main.ingest(ctx) == "ok"

    async with ctx["sessionmaker"]() as s:
        rows = (
            await s.execute(text("SELECT id, hazard, model_version, inputs, result FROM risk_snapshots"))
        ).all()
        alerts = (await s.execute(text("SELECT id, type, severity, snapshot_id, rule_id FROM alerts"))).all()
        n_aq = await s.scalar(text("SELECT count(*) FROM aqi_obs"))
    snaps = {r.hazard: r for r in rows}
    assert sorted(snaps) == ["aqi", "flood", "heat", "recommend", "weather"] and len(rows) == 5
    assert {r.model_version for r in rows} == {"pdim-s1"}
    # /api/<hazard> `data`: services pass through, except heatController's reshape of getHeatData.
    raw_heat = SCENARIO["outputs"]["heat"]
    expected = {
        **SCENARIO["outputs"],
        "weather": SCENARIO["inputs"]["weather"],
        "heat": {
            "city": "hcmc",
            "timestamp": raw_heat["timestamp"],
            "avgTemperature": raw_heat["cityAvgTemp"],
            "maxTemperature": raw_heat["cityMaxEffectiveTemp"],
            "heatIslandIntensity": raw_heat["uhiEffect"],
            "avgEffectiveTemperature": expected_mean_teff(raw_heat),
            "hotspots": [
                {"id": h["id"], "name": HEAT_NAMES[h["id"]], "lat": h["lat"], "lng": h["lng"]}
                | {"temperature": h["effectiveTemperature"], "intensity": h["urbanDensity"]}
                for h in raw_heat["hotspots"]
            ],
            "geojson": {
                "type": "FeatureCollection",
                "features": [
                    {
                        "type": "Feature",
                        "geometry": {"type": "Point", "coordinates": [h["lng"], h["lat"]]},
                        "properties": {
                            "temperature": h["effectiveTemperature"],
                            "intensity": h["urbanDensity"],
                        },
                    }
                    for h in raw_heat["hotspots"]
                ],
            },
        },
    }
    for h, r in snaps.items():
        assert same(r.result, expected[h]), h
    assert snaps["flood"].inputs == {
        "rainfall": SCENARIO["inputs"]["weather"]["current"]["rainfall"],
        "month": 10,
    }
    assert n_aq == 24  # city + 23 stations

    legacy_alerts = SCENARIO["outputs"]["alertsFirstCall"]["alerts"]
    assert sorted(a.type for a in alerts) == sorted(a["type"] for a in legacy_alerts)
    by_id = {r.id: r.hazard for r in rows}
    for a in alerts:
        assert a.severity in {"info", "warning", "critical"} and a.rule_id == f"A-{a.type.upper()}"
        assert by_id[a.snapshot_id] == ALERT_SNAPSHOT[a.type]

    pub = ctx["redis"].published
    assert {ch for ch, _, _ in pub} == {"ucdt:events"}
    assert all(visible == 5 for _, _, visible in pub)  # every event sent after commit
    assert [e for _, e, _ in pub] == [{"type": "snapshot.updated", "hazard": h} for h in HAZARDS] + [
        {"type": "alert.created", "id": a.id}
        for a in sorted(alerts, key=lambda a: int(a.id.rsplit("-", 1)[1]))
    ]

    # Second run: active unread alerts dedupe; only snapshot events go out.
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
