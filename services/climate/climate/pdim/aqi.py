"""Air quality: EPA PM2.5 -> US AQI, the S1 γ-nowcast and the AQIResponse assembly.

Ported from Hackathon-BE/src: utils/dataTransformer.ts (pm25ToAQI, normalizeAQI),
external/iqair.client.ts (fetchOpenMeteoAQI's `current` -> raw mapping) and
services/aqi.service.ts (buildNowcast24h, trend, getAQI assembly).
"""

from datetime import datetime, timedelta

from climate.pdim.constants import get_aqi_category
from climate.pdim.risk import aqi_nowcast_step, as_utc, js_iso, js_round
from climate.spatial.units import AQI_POINTS

# EPA 2012 PM2.5 breakpoints: (cLow, cHigh, iLow, iHigh).
_PM25_BREAKPOINTS = (
    (0.0, 12.0, 0, 50),
    (12.1, 35.4, 51, 100),
    (35.5, 55.4, 101, 150),
    (55.5, 150.4, 151, 200),
    (150.5, 250.4, 201, 300),
    (250.5, 350.4, 301, 400),
    (350.5, 500.4, 401, 500),
)


def pm25_to_aqi(concentration: float) -> int:
    """PM2.5 (µg/m³) -> US AQI via the EPA 2012 table; 1-decimal rounding first."""
    c = js_round(concentration * 10) / 10
    for c_lo, c_hi, i_lo, i_hi in _PM25_BREAKPOINTS:
        if c_lo <= c <= c_hi:
            return js_round(((i_hi - i_lo) / (c_hi - c_lo)) * (c - c_lo) + i_lo)
    return 500 if c > 500 else 0


def normalize_aqi(raw_value: float, source: str) -> int:
    """Bring a provider value onto the US AQI 0-500 scale."""
    return pm25_to_aqi(raw_value) if source == "openaq" else js_round(raw_value)


def _or0(v):
    return 0 if v is None else v


def raw_from_open_meteo(current: dict | None) -> dict:
    """Open-Meteo air-quality `current` block -> AQIRawData."""
    c = current or {}
    pm25 = _or0(c.get("pm2_5"))
    return {
        "aqi": pm25_to_aqi(pm25),
        "pm25": pm25,
        "pm10": _or0(c.get("pm10")),
        "o3": _or0(c.get("ozone")),
        "no2": _or0(c.get("nitrogen_dioxide")),
        "source": "openmeteo",
    }


def build_nowcast_24h(current_aqi: float, weather_forecast: list, now: datetime) -> list:
    """24 h series of AQI(t+1) = AQI(t)·(1 − γ_w·W̃)·(1 − γ_p·P̃); flat persistence past the forecast."""
    # Legacy truncates to the hour in HCMC local time; UTC+7 is a whole-hour offset, so UTC is the same.
    hour0 = as_utc(now).replace(minute=0, second=0, microsecond=0)
    series = []
    aqi = current_aqi
    for i in range(24):
        wf = weather_forecast[i] if i < len(weather_forecast) else {}
        hour = wf.get("hour")
        if hour is None:
            hour = js_iso(hour0 + timedelta(hours=i))
        series.append({"hour": hour, "aqi": js_round(aqi)})
        aqi = aqi_nowcast_step(aqi, _or0(wf.get("windSpeed")), _or0(wf.get("rainfall")))
    return series


def aqi_trend(forecast24h: list) -> str:
    first = sum(f["aqi"] for f in forecast24h[:6]) / 6
    last = sum(f["aqi"] for f in forecast24h[18:]) / 6
    if last > first * 1.05:
        return "increasing"
    if last < first * 0.95:
        return "decreasing"
    return "stable"


def compute_aqi(city_raw: dict | None, station_raws: list, forecast: list | None, now: datetime) -> dict:
    """AQIResponse. `station_raws` is aligned with AQI_POINTS; None = fetch failed (dropped)."""
    if city_raw is None:
        raise ValueError("city-level AQI unavailable")
    aqi = normalize_aqi(city_raw["aqi"], city_raw["source"])
    forecast24h = build_nowcast_24h(aqi, forecast or [], now)
    stations = [
        {
            "id": p["id"],
            "name": p["name"],
            "lat": p["lat"],
            "lng": p["lng"],
            "aqi": normalize_aqi(raw["aqi"], raw["source"]),
        }
        for p, raw in zip(AQI_POINTS, station_raws, strict=True)
        if raw is not None
    ]
    return {
        "aqi": aqi,
        "category": get_aqi_category(aqi),
        "pm25": city_raw["pm25"],
        "pm10": city_raw["pm10"],
        "o3": city_raw["o3"],
        "no2": city_raw["no2"],
        "trend": aqi_trend(forecast24h),
        "forecast24h": forecast24h,
        "stations": stations,
    }
