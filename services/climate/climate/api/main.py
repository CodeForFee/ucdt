"""Internal climate HTTP API. Its only client is the gateway, which forwards the incoming query
string as-is (legacy lat/lng/city/cityId are accepted and ignored — one city), maps 404->404,
422->400 and any other non-2xx->502, and wraps these bare bodies in the legacy envelope.

Run: `uvicorn climate.api.main:app`.
"""

import itertools
from collections.abc import AsyncIterator
from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from climate.api.models import (
    LATEST_MODELS,
    AlertsResponse,
    HistoryEntry,
    MarkReadRequest,
    MarkReadResponse,
    SimulationRequest,
    SimulationResult,
)
from climate.config import get_settings
from climate.db import repo
from climate.db.session import get_sessionmaker
from climate.pdim.risk import epoch_ms, js_iso
from climate.pdim.simulation import run_simulation

app = FastAPI(title="UCDT climate API", version="1.0.0", generate_unique_id_function=lambda r: r.name)


async def get_session() -> AsyncIterator[AsyncSession]:
    """One transaction per request: committed on success, rolled back on any exception."""
    async with get_sessionmaker()() as s, s.begin():
        yield s


Session = Annotated[AsyncSession, Depends(get_session)]
NO_SNAPSHOT = {503: {"description": "no snapshot yet"}}


async def _latest_result(session: AsyncSession, hazard: str) -> tuple[dict, datetime]:
    snap = await repo.latest_snapshot(session, hazard)
    if snap is None:
        raise HTTPException(503, "no snapshot yet")
    return snap["result"], snap["computed_at"]


def _latest_route(hazard: str):
    async def latest(session: Session):
        result, computed_at = await _latest_result(session, hazard)
        stale_after = timedelta(minutes=get_settings().stale_after_minutes)
        return {
            **result,
            "observedAt": js_iso(computed_at),
            "stale": datetime.now(UTC) - computed_at > stale_after,
        }

    return latest


for _hazard, _model in LATEST_MODELS.items():
    app.get(
        f"/v1/{_hazard}/latest",
        response_model=_model,
        responses=NO_SNAPSHOT,
        operation_id=f"latest_{_hazard}",
        tags=["latest"],
    )(_latest_route(_hazard))


@app.get("/v1/alerts", response_model=AlertsResponse, tags=["alerts"])
async def list_alerts(session: Session):
    rows = await repo.list_active_alerts(session, datetime.now(UTC))
    alerts = [
        {
            "id": r["id"],
            "severity": r["severity"],
            "type": r["type"],
            "title": r["title"],
            "message": r["message"],
            "isRead": r["read_at"] is not None,
            "createdAt": js_iso(r["created_at"]),
            "expiresAt": js_iso(r["expires_at"]),
        }
        for r in rows
    ]
    return {
        "alerts": alerts,
        "unreadCount": sum(not a["isRead"] for a in alerts),
        "totalCount": len(alerts),
    }


@app.post("/v1/alerts/read", response_model=MarkReadResponse, tags=["alerts"])
async def mark_read(body: MarkReadRequest, session: Session):
    return {"marked": await repo.mark_alerts_read(session, body.ids, datetime.now(UTC))}


_sim_counter = itertools.count(1)  # legacy `sim-<ms>-<n>`, n per process


@app.post("/v1/simulation", response_model=SimulationResult, responses=NO_SNAPSHOT, tags=["simulation"])
async def simulate(session: Session, body: SimulationRequest = SimulationRequest()):  # noqa: B008
    """Live what-if against the latest weather/flood/aqi snapshots (what legacy runSimulation fetched)."""
    scenario = body.scenario.model_dump()
    weather, _ = await _latest_result(session, "weather")
    flood, _ = await _latest_result(session, "flood")
    aqi, _ = await _latest_result(session, "aqi")
    now = datetime.now(UTC)
    return run_simulation(
        scenario, weather, flood, aqi, now, simulation_id=f"sim-{epoch_ms(now)}-{next(_sim_counter)}"
    )


@app.get("/v1/history/{hazard}", response_model=list[HistoryEntry], tags=["history"])
async def history(session: Session, hazard: str, hours: Annotated[int, Query(ge=1, le=168)] = 24):
    """Snapshots of the last `hours`, oldest first."""
    if hazard not in LATEST_MODELS:
        raise HTTPException(404, f"unknown hazard {hazard!r}")
    rows = await repo.history(session, hazard, datetime.now(UTC) - timedelta(hours=hours))
    return [{"computedAt": js_iso(r["computed_at"]), "result": r["result"]} for r in rows]


@app.get("/healthz", tags=["ops"])
async def healthz(session: Session) -> dict[str, str]:
    await session.execute(text("SELECT 1"))
    return {"status": "ok"}
