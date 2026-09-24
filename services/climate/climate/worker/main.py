"""arq worker: ingest -> score -> store -> publish, every `ingest_interval_minutes` and once on
startup.

    uv run arq climate.worker.main.WorkerSettings           # run forever
    uv run arq climate.worker.main.WorkerSettings --burst   # one run, then exit

Events go to Redis channel `ucdt:events` only AFTER the DB transaction commits:
{"type":"snapshot.updated","hazard":h} per hazard and {"type":"alert.created","id":id} per new alert.
"""

import asyncio
import json
import logging
from datetime import UTC, datetime

import httpx
from arq import cron
from arq.connections import RedisSettings

from climate.config import get_settings
from climate.db.session import get_sessionmaker
from climate.ingest.air import fetch_aq
from climate.ingest.weather import fetch_forecast
from climate.pdim.constants import DEFAULT_CITY
from climate.snapshots import store_run
from climate.spatial.units import AQI_POINTS

# Under "arq." so the arq CLI's log config prints it (it only configures the "arq" logger).
log = logging.getLogger("arq.climate")
CHANNEL = "ucdt:events"


async def fetch_all(client: httpx.AsyncClient) -> tuple[dict, dict, list[dict | None]]:
    """(forecast_raw, city_aq, station_aqs). Raises when the forecast or the city AQI is missing."""
    s = get_settings()
    lat, lng = DEFAULT_CITY["lat"], DEFAULT_CITY["lng"]
    forecast, city, *stations = await asyncio.gather(
        fetch_forecast(client, lat, lng, s.city_timezone),
        fetch_aq(client, lat, lng, s),
        *(fetch_aq(client, p["lat"], p["lng"], s) for p in AQI_POINTS),
    )
    if city is None:
        raise RuntimeError("city-level AQI unavailable from every source")
    return forecast, city, stations


async def ingest(ctx: dict) -> str:
    now = datetime.now(UTC)
    try:
        forecast, city, stations = await fetch_all(ctx["http"])
    except Exception as e:  # any upstream failure: keep the last good snapshots, T-007 marks them stale
        # Status code, never str(e): the URL of a fallback AQ source carries its API key.
        status = e.response.status_code if isinstance(e, httpx.HTTPStatusError) else ""
        log.error("ingest skipped: upstream fetch failed: %s %s", type(e).__name__, status)
        return "skipped"
    async with ctx["sessionmaker"]() as s, s.begin():
        hazards, alert_ids = await store_run(s, forecast, city, stations, now)
    # Committed. Publish now, never inside the transaction: a subscriber refetching on the event
    # must see the new rows.
    events = [{"type": "snapshot.updated", "hazard": h} for h in hazards]
    events += [{"type": "alert.created", "id": i} for i in alert_ids]
    for e in events:
        await ctx["redis"].publish(CHANNEL, json.dumps(e))
    log.info("ingest ok: %d snapshots, %d new alerts", len(hazards), len(alert_ids))
    return "ok"


async def startup(ctx: dict) -> None:
    ctx["http"] = httpx.AsyncClient(timeout=8)  # legacy per-request timeout
    ctx["sessionmaker"] = get_sessionmaker()


async def shutdown(ctx: dict) -> None:
    await ctx["http"].aclose()


class WorkerSettings:
    _s = get_settings()
    functions = []
    # ponytail: minute set assumes the interval divides 60 (15 does); use a loop job otherwise.
    cron_jobs = [
        cron(ingest, minute=set(range(0, 60, _s.ingest_interval_minutes)), run_at_startup=True, keep_result=0)
    ]
    on_startup = startup
    on_shutdown = shutdown
    redis_settings = RedisSettings.from_dsn(_s.redis_url)
