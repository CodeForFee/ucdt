"""One scoring run: fetched weather + air quality in, observations + the five risk snapshots +
new alerts written. Pure PDIM functions do the maths; repo.py does the writes. The caller owns
the transaction, so a run lands completely or not at all:

    async with get_sessionmaker()() as s, s.begin():
        hazards, alert_ids = await store_run(s, forecast_raw, city_aq, station_aqs, now)
    # publish only here, after commit

`result` of each snapshot is exactly the legacy Hackathon-BE `data` payload of `/api/<hazard>`.
"""

from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession

from climate.config import get_settings
from climate.db import repo
from climate.ingest.weather import local_time, transform_forecast
from climate.pdim import aqi, flood, heat, rules
from climate.spatial.units import AQI_POINTS

MODEL_VERSION = "pdim-s1"
HAZARDS = ("weather", "aqi", "flood", "heat", "recommend")
# Which snapshot an alert of each type was raised from.
ALERT_SNAPSHOT = {"flood": "flood", "aqi": "aqi", "heat": "heat", "storm": "weather", "system": "recommend"}


def heat_payload(raw: dict, city: str) -> dict:
    """Legacy /api/heat served heatController's reshape of getHeatData, not the service output
    (Hackathon-BE/src/controllers/heat.controller.ts). The other four controllers pass through."""
    return {
        "city": city,
        "timestamp": raw["timestamp"],
        "avgTemperature": raw["cityAvgTemp"],
        "maxTemperature": raw["cityMaxEffectiveTemp"],
        "heatIslandIntensity": raw["uhiEffect"],
        # Not in legacy heatController (an additive field; legacy keys unchanged): the mean
        # T_eff of the 22 cells, the baseline the heat what-if's ΔT applies to (B-020).
        "avgEffectiveTemperature": heat.mean_effective_temp(raw["hotspots"]),
        "hotspots": [
            {"id": h["id"], "name": h["name"], "lat": h["lat"], "lng": h["lng"]}
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


async def store_run(
    session: AsyncSession,
    forecast_raw: dict,
    city_aq: dict,
    station_aqs: list[dict | None],
    now: datetime,
) -> tuple[list[str], list[str]]:
    """Score and store one run. `station_aqs` is aligned with AQI_POINTS (None = fetch failed,
    dropped like legacy). Returns (hazards written, newly inserted alert ids)."""
    weather = transform_forecast(forecast_raw, now)
    month = local_time(forecast_raw, now).month
    rainfall = weather["current"]["rainfall"]

    fl = flood.compute_flood(rainfall, month)
    aq = aqi.compute_aqi(city_aq, station_aqs, weather["forecast"], now)
    results = {
        "weather": weather,
        "aqi": aq,
        "flood": fl,
        "heat": heat_payload(heat.compute_heat(weather["current"], now), get_settings().city_id),
        "recommend": rules.recommendations(weather, fl, aq, now),
    }
    inputs = {
        "weather": {"openMeteo": forecast_raw},
        "aqi": {"city": city_aq, "stations": station_aqs, "forecast": weather["forecast"]},
        "flood": {"rainfall": rainfall, "month": month},
        "heat": {"current": weather["current"]},
        "recommend": {"current": weather["current"], "rainfall": rainfall, "month": month, "aqi": aq["aqi"]},
    }

    await repo.insert_weather_obs(session, "city", now, forecast_raw)
    for loc, raw in [("city", city_aq), *zip((p["id"] for p in AQI_POINTS), station_aqs, strict=True)]:
        if raw is not None:
            await repo.insert_aqi_obs(
                session,
                loc,
                now,
                aqi=aqi.normalize_aqi(raw["aqi"], raw["source"]),
                **{k: raw[k] for k in ("pm25", "pm10", "o3", "no2", "source")},
            )

    ids = {
        h: await repo.insert_snapshot(session, h, now, MODEL_VERSION, inputs[h], results[h]) for h in HAZARDS
    }

    active = [
        {"type": a["type"], "isRead": a["read_at"] is not None}
        for a in await repo.list_active_alerts(session, now)
    ]
    fresh = rules.new_alerts(weather, fl, aq, now, active)
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
                "created_at": now,
                "expires_at": datetime.fromisoformat(a["expiresAt"]),
                "read_at": now if a["isRead"] else None,
                "snapshot_id": ids[ALERT_SNAPSHOT[a["type"]]],
            }
            for a in fresh
        ],
    )
    return list(HAZARDS), alert_ids
