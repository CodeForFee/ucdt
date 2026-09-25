"""One scoring run: per-unit weather + air quality + open-network readings in, observations + the
five risk snapshots + new per-unit alerts written. Pure PDIM functions do the maths; repo.py does
the reads and writes. The caller owns the transaction, so a run lands completely or not at all:

    async with get_sessionmaker()() as s, s.begin():
        hazards, alert_ids = await store_run(s, weather_by_unit, city_aq, station_aqs, readings, now)
    # publish only here, after commit

`inputs` of each snapshot is what its model consumed; the what-if (§G) re-runs from the flood, heat
and aqi `inputs` + `result`, and Algorithm 1 (§H) reads aqi `inputs.pointWeather/stationMap`.
"""

from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession

from climate.config import get_settings
from climate.db import repo
from climate.pdim import aqi, flood, heat, maturity, rules
from climate.spatial.catalogue import Catalogue, load_catalogue

HAZARDS = ("weather", "aqi", "flood", "heat", "recommend")
# Which snapshot an alert of each type was raised from.
ALERT_SNAPSHOT = {"flood": "flood", "storm": "weather", "aqi": "aqi", "heat": "heat"}


async def evaluate_maturity(session: AsyncSession, now: datetime) -> dict:
    """Algorithm 1 on the stored history of the last W (spec §H); what `/v1/maturity` serves."""
    since = now - maturity.WINDOW
    return maturity.evaluate(
        await repo.station_readings(session, since),
        await repo.snapshot_inputs(session, "aqi", since, ("pointWeather", "stationMap")),
        await repo.oldest_snapshot_at(session),
        now,
    )


async def store_run(
    session: AsyncSession,
    weather_by_unit: dict[str, dict],
    city_aq: dict,
    station_aqs: list[dict | None],
    readings: list[dict],
    now: datetime,
    cat: Catalogue | None = None,
) -> tuple[list[str], list[str]]:
    """Score and store one run. `weather_by_unit` = ingest.weather.fetch_weather_by_unit (unit id →
    WeatherResponse, plus "city"); `station_aqs` is aligned with the catalogue's AQI points (None =
    fetch failed, dropped); `readings` = ingest.airgradient.fetch_airgradient. Returns (hazards
    written, newly inserted alert ids)."""
    cat = cat or load_catalogue()
    city_w = weather_by_unit["city"]
    cur = {uid: w["current"] for uid, w in weather_by_unit.items()}
    gammas, aqi_version = maturity.nowcast_gammas(await evaluate_maturity(session, now))

    rain = {z.id: cur[z.id]["rainfall"] for z in cat.flood_zones}
    fl = flood.compute_flood(rain, cur["city"]["rainfall"], cat)
    ht = heat.compute_heat(cur, cur["city"], now, cat, get_settings().city_id)
    observed = aqi.observed_stations(readings, cat)
    aq = aqi.compute_aqi(city_aq, station_aqs, city_w["forecast"], now, observed, gammas, cat)

    # Per-unit values of this run and of the previous snapshots (read before this run's inserts).
    values = rules.unit_values(fl, aq, ht)
    prev = [await repo.latest_snapshot(session, h) for h in ("flood", "aqi", "heat")]
    prev_values = rules.unit_values(*(p["result"] if p else None for p in prev))

    results = {
        "weather": city_w,
        "aqi": aq,
        "flood": fl,
        "heat": ht,
        "recommend": rules.recommendations(values, cat, now),
    }
    point_weather = {
        uid: {"windSpeed": cur[uid]["windSpeed"], "rainfall": cur[uid]["rainfall"]}
        for uid in (*(p.id for p in cat.aqi_points), "city")
    }
    inputs = {
        "weather": {"units": cur},
        "aqi": {
            "city": city_aq,
            "points": dict(zip((p.id for p in cat.aqi_points), station_aqs, strict=True)),
            "pointWeather": point_weather,
            "forecast": city_w["forecast"],
            "observed": readings,
            "stationMap": {s["id"]: s["nearestPointId"] for s in observed},
            "nowcastGammas": list(gammas),
        },
        "flood": {"rainfall": rain, "cityRainfall": cur["city"]["rainfall"]},
        "heat": {"weather": {c.id: cur[c.id] for c in cat.heat_cells}, "city": cur["city"]},
        "recommend": {"values": values},
    }

    await repo.insert_weather_obs(session, "city", now, city_w)
    for loc, raw in [("city", city_aq), *zip((p.id for p in cat.aqi_points), station_aqs, strict=True)]:
        if raw is not None:
            await repo.insert_aqi_obs(
                session,
                loc,
                now,
                aqi=aqi.normalize_aqi(raw["aqi"], raw["source"]),
                **{k: raw[k] for k in ("pm25", "pm10", "o3", "no2", "source")},
            )
    for (
        s
    ) in observed:  # stamped with the observation time, so Algorithm 1 bins it by the hour it was measured
        await repo.insert_aqi_obs(
            session,
            s["id"],
            datetime.fromisoformat(s["observedAt"]),
            aqi=s["aqi"],
            pm25=s["pm25"],
            source=s["source"],
        )

    ids = {
        h: await repo.insert_snapshot(
            session, h, now, aqi_version if h == "aqi" else maturity.MODEL_S1, inputs[h], results[h]
        )
        for h in HAZARDS
    }

    fresh = rules.band_alerts(values, prev_values, cat, now)
    alert_ids = await repo.insert_alerts(
        session,
        [
            {
                "id": a["id"],
                "rule_id": f"A-{a['type'].upper()}",
                "type": a["type"],
                "severity": a["severity"],
                "title": a["title"],
                "message": a["message"],
                "unit_id": a["unitId"],
                "unit_name": a["unitName"],
                "value": a["value"],
                "created_at": now,
                "expires_at": datetime.fromisoformat(a["expiresAt"]),
                "snapshot_id": ids[ALERT_SNAPSHOT[a["type"]]],
            }
            for a in fresh
        ],
    )
    return list(HAZARDS), alert_ids
