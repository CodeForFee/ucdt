"""Internal climate HTTP API. Its only client is the gateway, which forwards the incoming query
string as-is (legacy lat/lng/city/cityId are accepted and ignored — one city), maps 404->404,
422->400 and any other non-2xx->502, and wraps these bare bodies in the legacy envelope.

Snapshots written before S-002 (old payload shape) are never served: a latest snapshot that fails
its response model, or a what-if baseline missing an S-002 key, is a 503 like "no snapshot yet".

Run: `uvicorn climate.api.main:app`.
"""

import itertools
import logging
from collections.abc import AsyncIterator
from datetime import UTC, datetime, timedelta
from typing import Annotated, get_args

from fastapi import Depends, FastAPI, HTTPException, Query
from pydantic import ValidationError
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from climate import snapshots
from climate.api.models import (
    LATEST_MODELS,
    AlertSeverity,
    AlertsResponse,
    AlertType,
    HistoryEntry,
    MarkReadRequest,
    MarkReadResponse,
    MaturityResponse,
    SimulationRequest,
    SimulationResult,
    UnitRow,
)
from climate.config import get_settings
from climate.db import repo
from climate.db.session import get_sessionmaker
from climate.pdim.risk import epoch_ms, js_iso
from climate.pdim.simulation import run_counterfactual
from climate.spatial.catalogue import load_catalogue

log = logging.getLogger(__name__)
app = FastAPI(title="UCDT climate API", version="1.0.0", generate_unique_id_function=lambda r: r.name)


async def get_session() -> AsyncIterator[AsyncSession]:
    """One transaction per request: committed on success, rolled back on any exception."""
    async with get_sessionmaker()() as s, s.begin():
        yield s


Session = Annotated[AsyncSession, Depends(get_session)]
NO_SNAPSHOT = {503: {"description": "no snapshot yet, or none in the current (S-002) shape"}}
OLD_SHAPE = "no snapshot yet in the current shape"


async def _latest(session: AsyncSession, hazard: str) -> dict:
    snap = await repo.latest_snapshot(session, hazard)
    if snap is None:
        raise HTTPException(503, "no snapshot yet")
    return snap


def _latest_route(hazard: str, model):
    async def latest(session: Session):
        snap = await _latest(session, hazard)
        stale_after = timedelta(minutes=get_settings().stale_after_minutes)
        body = {
            **snap["result"],
            "observedAt": js_iso(snap["computed_at"]),
            "stale": datetime.now(UTC) - snap["computed_at"] > stale_after,
            "modelVersion": snap["model_version"],
        }
        try:
            model.model_validate(body)
        except ValidationError as e:
            log.warning("%s snapshot %s is not in the current shape: %s", hazard, snap["id"], e)
            raise HTTPException(503, OLD_SHAPE) from None
        return body

    return latest


for _hazard, _model in LATEST_MODELS.items():
    app.get(
        f"/v1/{_hazard}/latest",
        response_model=_model,
        response_model_exclude_unset=True,  # optional typed fields absent in the stored result stay absent
        responses=NO_SNAPSHOT,
        operation_id=f"latest_{_hazard}",
        tags=["latest"],
    )(_latest_route(_hazard, _model))


_ALERT_TYPES, _SEVERITIES = set(get_args(AlertType)), set(get_args(AlertSeverity))


@app.get("/v1/alerts", response_model=AlertsResponse, tags=["alerts"])
async def list_alerts(session: Session):
    """Active per-unit alerts (§F), newest first, critical before warning within a run. Rows of the
    pre-S-002 types (the dropped always-on `system` / `info` alert) are not served."""
    rows = [
        r
        for r in await repo.list_active_alerts(session, datetime.now(UTC))
        if r["type"] in _ALERT_TYPES and r["severity"] in _SEVERITIES
    ]
    rows.sort(key=lambda r: (r["created_at"], r["severity"] == "critical"), reverse=True)  # stable
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


@app.post(
    "/v1/simulation",
    response_model=SimulationResult,
    response_model_exclude_unset=True,
    responses=NO_SNAPSHOT,
    tags=["simulation"],
)
async def simulate(session: Session, body: SimulationRequest = SimulationRequest()):  # noqa: B008
    """What-if (§G, Algorithm 2 step 7): scoring, alerts and ℛ re-run on the counterfactual state
    built from the latest flood, heat and aqi snapshots."""
    snaps = {h: await _latest(session, h) for h in ("flood", "heat", "aqi")}
    now = datetime.now(UTC)
    try:
        return run_counterfactual(
            body.scenario.model_dump(),
            snaps,
            now,
            simulation_id=f"sim-{epoch_ms(now)}-{next(_sim_counter)}",
        )
    except KeyError as e:  # a pre-S-002 snapshot lacks rainfall / baselines / pointWeather
        log.warning("what-if baseline is not in the current shape: missing %s", e)
        raise HTTPException(503, OLD_SHAPE) from None


@app.get("/v1/maturity", response_model=MaturityResponse, tags=["maturity"])
async def maturity(session: Session):
    """Algorithm 1 evaluated now on the stored history (§H line 8)."""
    return await snapshots.evaluate_maturity(session, datetime.now(UTC))


@app.get("/v1/units", response_model=list[UnitRow], tags=["units"])
async def units():
    """Unit -> 2025 commune mapping table of the data layer (§A.3), from the committed catalogue."""
    cat = load_catalogue()
    kinds = (("flood_zone", cat.flood_zones), ("heat_cell", cat.heat_cells), ("aqi_point", cat.aqi_points))
    return [
        {"id": u.id, "kind": k, "name": u.name, "lat": u.lat, "lng": u.lng}
        | {"commune": u.commune, "communeOsmId": u.commune_osm_id}
        for k, us in kinds
        for u in us
    ]


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
