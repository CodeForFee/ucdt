from collections import Counter
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from climate.db import repo
from climate.spatial.units import ALL_UNITS

T0 = datetime(2026, 9, 23, 12, 0, tzinfo=UTC)
H = timedelta(hours=1)


def alert(id_: str, created_at: datetime, expires_at: datetime, **kw) -> dict:
    return {
        "id": id_,
        "rule_id": "R-FLOOD-01",
        "type": "flood",
        "severity": "high",
        "title": f"title {id_}",
        "message": f"message {id_}",
        "created_at": created_at,
        "expires_at": expires_at,
        **kw,
    }


async def test_spatial_units_seeded_with_kinds_geom_and_props(session):
    units = await repo.list_spatial_units(session)
    assert len(units) == 63
    assert Counter(u["kind"] for u in units) == {"flood_zone": 18, "heat_cell": 22, "aqi_point": 23}

    by_id = {u["id"]: u for u in units}
    for src in ALL_UNITS:
        got = by_id[src["id"]]
        assert (got["kind"], got["name"]) == (src["kind"], src["name"])
        assert got["lat"] == pytest.approx(src["lat"]) and got["lng"] == pytest.approx(src["lng"])
        assert got["props"] == {k: v for k, v in src.items() if k not in {"id", "kind", "name", "lat", "lng"}}

    assert by_id["gz-q8-rach-ong"]["props"] == {"localDrain": 0.30, "terrain": 0.60}
    assert by_id["q1"]["props"] == {"urbanDensity": 0.97}
    assert by_id["station-q1"]["props"] == {}

    # Spot-check the stored geography itself, independent of the repo query.
    lat, lng, srid = (
        await session.execute(
            text(
                "SELECT ST_Y(geom::geometry), ST_X(geom::geometry), ST_SRID(geom) "
                "FROM spatial_units WHERE id = 'station-cangio'"
            )
        )
    ).one()
    assert (lat, lng, srid) == (pytest.approx(10.4120), pytest.approx(106.9520), 4326)

    heat = await repo.list_spatial_units(session, kind="heat_cell")
    assert len(heat) == 22 and {u["kind"] for u in heat} == {"heat_cell"}


async def test_check_constraints(session):
    with pytest.raises(IntegrityError):
        async with session.begin_nested():
            await session.execute(
                text(
                    "INSERT INTO spatial_units (id, kind, name, geom) "
                    "VALUES ('x', 'bogus', 'x', 'POINT(0 0)')"
                )
            )
    with pytest.raises(IntegrityError):
        async with session.begin_nested():
            await repo.insert_snapshot(session, "tsunami", T0, "v1", {}, {})


async def test_insert_observations(session):
    wid = await repo.insert_weather_obs(session, "city", T0, {"temp": 31.5, "hourly": [1, 2]})
    aid = await repo.insert_aqi_obs(session, "station-q1", T0, aqi=87, pm25=28.4, source="open-meteo")
    bare = await repo.insert_aqi_obs(session, "city", T0)
    assert isinstance(wid, int) and bare > aid

    w = (
        await session.execute(
            text("SELECT location_id, fetched_at, payload FROM weather_obs WHERE id = :i"), {"i": wid}
        )
    ).one()
    assert tuple(w) == ("city", T0, {"temp": 31.5, "hourly": [1, 2]})
    a = (
        await session.execute(text("SELECT aqi, pm25, pm10, source FROM aqi_obs WHERE id = :i"), {"i": aid})
    ).one()
    assert tuple(a) == (87, 28.4, None, "open-meteo")


async def test_snapshots_latest_and_history(session):
    assert await repo.latest_snapshot(session, "flood") is None
    ids = [
        await repo.insert_snapshot(session, "flood", T0 + i * H, "pdim-s1", {"i": i}, {"score": i / 10})
        for i in (2, 0, 1)  # inserted out of order on purpose
    ]
    await repo.insert_snapshot(session, "heat", T0 + 5 * H, "pdim-s1", {}, [1, 2])

    latest = await repo.latest_snapshot(session, "flood")
    assert latest["id"] == ids[0] and latest["computed_at"] == T0 + 2 * H
    assert latest["inputs"] == {"i": 2} and latest["result"] == {"score": 0.2}
    assert latest["model_version"] == "pdim-s1" and latest["hazard"] == "flood"

    hist = await repo.history(session, "flood", since=T0 + H)
    assert [h["computed_at"] for h in hist] == [T0 + H, T0 + 2 * H]  # oldest first, since inclusive
    assert len(await repo.history(session, "flood", since=T0 - H)) == 3
    assert await repo.history(session, "aqi", since=T0) == []


async def test_insert_alerts_conflict_do_nothing(session):
    assert await repo.insert_alerts(session, []) == []
    assert await repo.insert_alerts(session, [alert("a1", T0, T0 + H), alert("a2", T0, T0 + H)]) == [
        "a1",
        "a2",
    ]
    # a1 again with a different title: skipped, original row kept.
    new = await repo.insert_alerts(
        session, [alert("a1", T0, T0 + H, title="changed"), alert("a3", T0, T0 + H)]
    )
    assert new == ["a3"]
    assert await session.scalar(text("SELECT title FROM alerts WHERE id = 'a1'")) == "title a1"


async def test_alert_snapshot_fk_set_null(session):
    sid = await repo.insert_snapshot(session, "flood", T0, "v1", {}, {})
    await repo.insert_alerts(session, [alert("fk", T0, T0 + H, snapshot_id=sid)])
    assert (await repo.list_active_alerts(session, T0))[0]["snapshot_id"] == sid
    await session.execute(text("DELETE FROM risk_snapshots WHERE id = :i"), {"i": sid})
    assert (await repo.list_active_alerts(session, T0))[0]["snapshot_id"] is None


async def test_list_active_alerts_filters_expired_and_orders_newest_first(session):
    await repo.insert_alerts(
        session,
        [
            alert("old", T0 - 3 * H, T0 + H),
            alert("new", T0 - H, T0 + H),
            alert("expired", T0 - 2 * H, T0 - H),
            alert("edge", T0 - 2 * H, T0),  # expires exactly now -> not active
        ],
    )
    active = await repo.list_active_alerts(session, T0)
    assert [a["id"] for a in active] == ["new", "old"]
    assert active[0]["read_at"] is None and active[0]["expires_at"] == T0 + H
    earlier = await repo.list_active_alerts(session, T0 - 2 * H)
    assert [a["id"] for a in earlier] == ["new", "edge", "expired", "old"]  # created_at ties -> by id


async def test_mark_alerts_read(session):
    await repo.insert_alerts(session, [alert(i, T0, T0 + H) for i in ("r1", "r2", "r3")])
    assert await repo.mark_alerts_read(session, [], T0) == 0
    assert await repo.mark_alerts_read(session, ["r1", "r2", "missing"], T0) == 2
    assert await repo.mark_alerts_read(session, ["r1", "r3"], T0 + H) == 1  # r1 already read
    read = {a["id"]: a["read_at"] for a in await repo.list_active_alerts(session, T0)}
    assert read == {"r1": T0, "r2": T0, "r3": T0 + H}


async def test_algorithm1_history_reads(session):
    assert await repo.oldest_snapshot_at(session) is None
    await repo.insert_snapshot(session, "aqi", T0 + H, "pdim-s1", {"pointWeather": {"p": 1}, "x": 9}, {})
    await repo.insert_snapshot(session, "aqi", T0, "pdim-s1", {"legacy": True}, {})
    await repo.insert_snapshot(session, "flood", T0 - H, "pdim-s1", {"pointWeather": {}}, {})
    rows = await repo.snapshot_inputs(session, "aqi", T0, ("pointWeather", "stationMap"))
    assert rows == [
        {"computed_at": T0, "pointWeather": None, "stationMap": None},
        {"computed_at": T0 + H, "pointWeather": {"p": 1}, "stationMap": None},
    ]
    assert await repo.oldest_snapshot_at(session) == T0 - H

    for loc, at, aqi, src in [
        ("ag:1", T0, 80, "airgradient"),
        ("ag:1", T0, 80, "airgradient"),  # the same reading re-fetched by the next run
        ("ag:1", T0 + H, None, "airgradient"),
        ("ag:2", T0 - H, 70, "airgradient"),  # before `since`
        ("station-q1", T0, 60, "openmeteo"),
    ]:
        await repo.insert_aqi_obs(session, loc, at, aqi=aqi, source=src)
    assert await repo.station_readings(session, T0) == [{"location_id": "ag:1", "fetched_at": T0, "aqi": 80}]
