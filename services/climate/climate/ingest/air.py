"""Air-quality clients, ported from Hackathon-BE/src/external/iqair.client.ts: Open-Meteo Air
Quality first (no key), then IQAir and AQICN only when their key is configured."""

import logging

import httpx

from climate.config import Settings
from climate.pdim.aqi import raw_from_open_meteo

log = logging.getLogger(__name__)

OPEN_METEO_AQ_URL = "https://air-quality-api.open-meteo.com/v1/air-quality"
IQAIR_URL = "https://api.airvisual.com/v2/nearest_city"
AQICN_URL = "https://api.waqi.info/feed/geo:{lat};{lng}/"


async def _open_meteo(client: httpx.AsyncClient, lat: float, lng: float) -> dict:
    res = await client.get(
        OPEN_METEO_AQ_URL,
        params={
            "latitude": lat,
            "longitude": lng,
            "current": "pm2_5,pm10,ozone,nitrogen_dioxide",
            "timezone": "auto",
        },
    )
    res.raise_for_status()
    return raw_from_open_meteo(res.json().get("current"))


async def _iqair(client: httpx.AsyncClient, lat: float, lng: float, key: str) -> dict | None:
    res = await client.get(IQAIR_URL, params={"lat": lat, "lon": lng, "key": key})
    res.raise_for_status()
    body = res.json()
    if body.get("status") != "success":
        return None
    aqius = (((body.get("data") or {}).get("current") or {}).get("pollution") or {}).get("aqius")
    return {
        "aqi": aqius or 0,
        "pm25": aqius * 0.35 if aqius else 0,  # legacy approximation: IQAir free tier has no PM data
        "pm10": aqius * 0.55 if aqius else 0,
        "o3": 0,
        "no2": 0,
        "source": "iqair",
    }


async def _aqicn(client: httpx.AsyncClient, lat: float, lng: float, token: str) -> dict | None:
    res = await client.get(AQICN_URL.format(lat=lat, lng=lng), params={"token": token})
    res.raise_for_status()
    body = res.json()
    data = body.get("data") or {}
    aqi = data.get("aqi")
    if body.get("status") != "ok" or not isinstance(aqi, int | float):  # AQICN sends "-" for no data
        return None
    iaqi = data.get("iaqi") or {}

    def v(name):
        return (iaqi.get(name) or {}).get("v", 0)

    return {
        "aqi": aqi,
        "pm25": v("pm25"),
        "pm10": v("pm10"),
        "o3": v("o3"),
        "no2": v("no2"),
        "source": "aqicn",
    }


async def fetch_aq(client: httpx.AsyncClient, lat: float, lng: float, settings: Settings) -> dict | None:
    """AQIRawData for a point, or None when every configured source failed."""
    sources = [("openmeteo", _open_meteo, ())]
    if settings.iqair_api_key:
        sources.append(("iqair", _iqair, (settings.iqair_api_key,)))
    if settings.aqicn_token:
        sources.append(("aqicn", _aqicn, (settings.aqicn_token,)))
    for name, fetch, extra in sources:
        try:
            raw = await fetch(client, lat, lng, *extra)
        except (httpx.HTTPError, ValueError, TypeError, AttributeError) as e:
            # Type only: an httpx error's text carries the URL, and with it the API key.
            log.warning("[%s] %s,%s failed: %s", name, lat, lng, type(e).__name__)
            continue
        if raw is not None:
            return raw
    return None
