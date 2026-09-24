"""Data access for the climate DB. Every function takes an AsyncSession and returns plain
dicts (column name -> value; timestamps are tz-aware datetimes, jsonb is decoded).

None of them commit: the caller owns the transaction (`async with session.begin(): ...`).
"""

from collections.abc import Iterable, Mapping
from datetime import datetime
from typing import Any

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from climate.db.models import alerts, aqi_obs, risk_snapshots, spatial_units, weather_obs


async def insert_weather_obs(
    session: AsyncSession, location_id: str, fetched_at: datetime, payload: Mapping[str, Any]
) -> int:
    return await session.scalar(
        sa.insert(weather_obs)
        .values(location_id=location_id, fetched_at=fetched_at, payload=payload)
        .returning(weather_obs.c.id)
    )


async def insert_aqi_obs(
    session: AsyncSession,
    location_id: str,
    fetched_at: datetime,
    *,
    aqi: int | None = None,
    pm25: float | None = None,
    pm10: float | None = None,
    o3: float | None = None,
    no2: float | None = None,
    source: str | None = None,
) -> int:
    """location_id is a spatial unit id or 'city'."""
    return await session.scalar(
        sa.insert(aqi_obs)
        .values(
            location_id=location_id,
            fetched_at=fetched_at,
            aqi=aqi,
            pm25=pm25,
            pm10=pm10,
            o3=o3,
            no2=no2,
            source=source,
        )
        .returning(aqi_obs.c.id)
    )


async def insert_snapshot(
    session: AsyncSession,
    hazard: str,
    computed_at: datetime,
    model_version: str,
    inputs: Mapping[str, Any],
    result: Any,
) -> int:
    return await session.scalar(
        sa.insert(risk_snapshots)
        .values(
            hazard=hazard, computed_at=computed_at, model_version=model_version, inputs=inputs, result=result
        )
        .returning(risk_snapshots.c.id)
    )


async def latest_snapshot(session: AsyncSession, hazard: str) -> dict | None:
    rows = await session.execute(
        sa.select(risk_snapshots)
        .where(risk_snapshots.c.hazard == hazard)
        .order_by(risk_snapshots.c.computed_at.desc(), risk_snapshots.c.id.desc())
        .limit(1)
    )
    row = rows.mappings().first()
    return dict(row) if row else None


async def history(session: AsyncSession, hazard: str, since: datetime) -> list[dict]:
    """Snapshots with computed_at >= since, OLDEST FIRST (chart order)."""
    rows = await session.execute(
        sa.select(risk_snapshots)
        .where(risk_snapshots.c.hazard == hazard, risk_snapshots.c.computed_at >= since)
        .order_by(risk_snapshots.c.computed_at, risk_snapshots.c.id)
    )
    return [dict(r) for r in rows.mappings()]


async def snapshot_inputs(
    session: AsyncSession, hazard: str, since: datetime, keys: Iterable[str]
) -> list[dict]:
    """[{computed_at, <key>: inputs[key] (None when absent)}] for snapshots since `since`, oldest
    first — only the named top-level keys of `inputs` leave the DB (Algorithm 1 history)."""
    keys = list(keys)
    rows = await session.execute(
        sa.select(risk_snapshots.c.computed_at, *(risk_snapshots.c.inputs[k].label(k) for k in keys))
        .where(risk_snapshots.c.hazard == hazard, risk_snapshots.c.computed_at >= since)
        .order_by(risk_snapshots.c.computed_at, risk_snapshots.c.id)
    )
    return [dict(r) for r in rows.mappings()]


async def oldest_snapshot_at(session: AsyncSession) -> datetime | None:
    return await session.scalar(sa.select(sa.func.min(risk_snapshots.c.computed_at)))


async def station_readings(session: AsyncSession, since: datetime, source: str = "airgradient") -> list[dict]:
    """Distinct (location_id, fetched_at, aqi) observations of one source since `since`, oldest
    first. A reading re-fetched by a later run is stored twice with the same observation time;
    DISTINCT counts it once."""
    rows = await session.execute(
        sa.select(aqi_obs.c.location_id, aqi_obs.c.fetched_at, aqi_obs.c.aqi)
        .distinct()
        .where(aqi_obs.c.source == source, aqi_obs.c.fetched_at >= since, aqi_obs.c.aqi.is_not(None))
        .order_by(aqi_obs.c.fetched_at, aqi_obs.c.location_id, aqi_obs.c.aqi)
    )
    return [dict(r) for r in rows.mappings()]


async def insert_alerts(session: AsyncSession, rows: Iterable[Mapping[str, Any]]) -> list[str]:
    """Insert alerts (keys: id, rule_id, type, severity, title, message, created_at, expires_at,
    optional snapshot_id). Ids already present are skipped; returns only the newly inserted ids."""
    rows = [{"snapshot_id": None, **r} for r in rows]
    if not rows:
        return []
    result = await session.scalars(
        pg_insert(alerts).values(rows).on_conflict_do_nothing(index_elements=["id"]).returning(alerts.c.id)
    )
    return list(result)


async def list_active_alerts(session: AsyncSession, now: datetime) -> list[dict]:
    """Alerts with expires_at > now, newest first. Read alerts are included (read_at set)."""
    rows = await session.execute(
        sa.select(alerts).where(alerts.c.expires_at > now).order_by(alerts.c.created_at.desc(), alerts.c.id)
    )
    return [dict(r) for r in rows.mappings()]


async def mark_alerts_read(session: AsyncSession, ids: Iterable[str], now: datetime) -> int:
    """Set read_at=now on the given ids that are still unread; returns how many changed."""
    ids = list(ids)
    if not ids:
        return 0
    result = await session.execute(
        sa.update(alerts).where(alerts.c.id.in_(ids), alerts.c.read_at.is_(None)).values(read_at=now)
    )
    return result.rowcount


async def list_spatial_units(session: AsyncSession, kind: str | None = None) -> list[dict]:
    """Units as {id, kind, name, lat, lng, props}, ordered by kind then id."""
    point = sa.func.geometry(spatial_units.c.geom)
    query = sa.select(
        spatial_units.c.id,
        spatial_units.c.kind,
        spatial_units.c.name,
        sa.func.ST_Y(point).label("lat"),
        sa.func.ST_X(point).label("lng"),
        spatial_units.c.props,
    ).order_by(spatial_units.c.kind, spatial_units.c.id)
    if kind is not None:
        query = query.where(spatial_units.c.kind == kind)
    return [dict(r) for r in (await session.execute(query)).mappings()]
