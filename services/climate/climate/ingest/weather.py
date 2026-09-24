"""Open-Meteo forecast client + transform, ported from Hackathon-BE/src/external/openmeteo.client.ts
and utils/dataTransformer.ts (transformOpenMeteoResponse), with B-012 fixed."""

import logging
from datetime import datetime, timedelta

import httpx

from climate.pdim.constants import DEFAULT_CITY
from climate.pdim.risk import as_utc, heat_index, js_iso, js_round
from climate.spatial.units import ALL_UNITS

log = logging.getLogger(__name__)

FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
HOURLY = "temperature_2m,precipitation,windspeed_10m,relativehumidity_2m,winddirection_10m"


async def fetch_forecast(client: httpx.AsyncClient, lat: float, lng: float, timezone: str) -> dict:
    """Raw Open-Meteo forecast. Raises on any HTTP/network error — the caller skips the run."""
    return (await fetch_forecast_multi(client, [(lat, lng)], timezone))[0]


async def fetch_forecast_multi(
    client: httpx.AsyncClient, coords: list[tuple[float, float]], timezone: str
) -> list[dict]:
    """Raw Open-Meteo forecasts for many points in ONE request, in `coords` order (spec §I.1).

    Open-Meteo answers a list for several locations and a bare object for one. Raises on any
    HTTP/network error or a location-count mismatch — the caller skips the run."""
    res = await client.get(
        FORECAST_URL,
        params={
            "latitude": ",".join(str(lat) for lat, _ in coords),
            "longitude": ",".join(str(lng) for _, lng in coords),
            "hourly": HOURLY,
            "current_weather": "true",
            # 2 days, not legacy's 1: once the current hour is found in LOCAL time (B-012), a
            # 1-day window leaves fewer than 24 forecast hours for most of the day.
            "forecast_days": 2,
            "timezone": timezone,
        },
    )
    res.raise_for_status()
    body = res.json()
    body = body if isinstance(body, list) else [body]
    if len(body) != len(coords):
        raise ValueError(f"Open-Meteo returned {len(body)} locations for {len(coords)} coordinates")
    return body


def unit_points() -> dict[str, tuple[float, float]]:
    """unit id -> (lat, lng) for all 63 units, plus "city" for the city centre."""
    points = {u["id"]: (u["lat"], u["lng"]) for u in ALL_UNITS}
    points["city"] = (DEFAULT_CITY["lat"], DEFAULT_CITY["lng"])
    return points


async def fetch_weather_by_unit(
    client: httpx.AsyncClient,
    timezone: str,
    now: datetime,
    points: dict[str, tuple[float, float]] | None = None,
) -> dict[str, dict]:
    """unit id -> WeatherResponse (`transform_forecast`, hour-aligned per location), plus "city".

    Units sharing a coordinate share one requested location. A location whose response is
    malformed falls back to the city-centre weather (logged); a malformed city centre raises,
    like any upstream failure, so the caller skips the run."""
    points = points or unit_points()
    coords = list(dict.fromkeys(points.values()))
    raws = await fetch_forecast_multi(client, coords, timezone)
    by_coord = {}
    for c, raw in zip(coords, raws, strict=True):
        try:
            if not raw["hourly"]["time"]:  # transform_forecast would silently invent defaults
                raise ValueError("no hourly times")
            by_coord[c] = transform_forecast(raw, now)
        except (KeyError, TypeError, ValueError, AttributeError) as e:
            log.warning("[openmeteo] malformed forecast at %s,%s: %s", *c, type(e).__name__)
    city = by_coord.get(points["city"])
    if city is None:
        raise ValueError("city-centre forecast malformed")
    return {uid: by_coord.get(c, city) for uid, c in points.items()}


def local_time(data: dict, now: datetime) -> datetime:
    """`now` as a naive wall-clock time in the timezone the forecast was requested in.

    Open-Meteo reports that zone's offset as `utc_offset_seconds`; using it avoids needing a tz
    database (Windows has none without the `tzdata` package)."""
    return as_utc(now).replace(tzinfo=None) + timedelta(seconds=data["utc_offset_seconds"])


def _wmo_condition(code: int) -> str:
    if code == 0:
        return "Trời quang"
    if code <= 2:
        return "Ít mây"
    if code == 3:
        return "Nhiều mây"
    for top, label in ((49, "Sương mù"), (59, "Mưa phùn"), (69, "Mưa"), (79, "Tuyết"), (84, "Mưa rào")):
        if code <= top:
            return label
    return "Dông bão" if code <= 99 else "Không xác định"


def _at(values: list, i: int):
    return values[i] if 0 <= i < len(values) else None


def _first(*values):
    """JS `a ?? b ?? c`."""
    return next((v for v in values if v is not None), None)


def _r1(x: float) -> float:
    return js_round(x * 10) / 10


def transform_forecast(data: dict, now: datetime) -> dict:
    """WeatherResponse {current, forecast[≤24]} from a raw Open-Meteo forecast.

    B-012: `hourly.time` is in the requested (HCMC) local time, so the current hour is matched
    on local wall-clock time. Legacy matched `now.toISOString()` (UTC) and landed 7 h early."""
    cw = data.get("current_weather") or {}
    hourly = data.get("hourly") or {}
    temps = hourly.get("temperature_2m") or []
    rains = hourly.get("precipitation") or []
    winds = hourly.get("windspeed_10m") or []
    dirs = hourly.get("winddirection_10m") or []
    hums = hourly.get("relativehumidity_2m") or []
    times = hourly.get("time") or []

    hour = local_time(data, now).strftime("%Y-%m-%dT%H")
    idx = next((i for i, t in enumerate(times) if t.startswith(hour)), 0)

    temp = _first(_at(temps, idx), cw.get("temperature"), 32)
    humidity = _first(_at(hums, idx), 75)
    rainfall = _first(_at(rains, idx), 0)
    wind = _first(_at(winds, idx), cw.get("windspeed"), 10)
    wind_dir = _first(_at(dirs, idx), cw.get("winddirection"), 220)

    forecast = []
    for i in range(idx, min(idx + 24, len(times))):
        rain_i = _first(_at(rains, i), 0)
        forecast.append(
            {
                "hour": times[i],
                "temperature": _r1(_first(_at(temps, i), temp)),
                "rainfall": _r1(rain_i),
                "windSpeed": _r1(_first(_at(winds, i), wind)),
                # Legacy heuristic, current humidity included as-is.
                "stormProbability": min(100, js_round(rain_i * 10 + (20 if humidity > 80 else 0))),
            }
        )

    return {
        "current": {
            "temperature": _r1(temp),
            "feelsLike": _r1(heat_index(temp, humidity)),
            "humidity": js_round(humidity),
            "rainfall": _r1(rainfall),
            "windSpeed": _r1(wind),
            "windDirection": js_round(wind_dir),
            "condition": _wmo_condition(_first(cw.get("weathercode"), 0)),
            "timestamp": js_iso(now),
        },
        "forecast": forecast,
    }
