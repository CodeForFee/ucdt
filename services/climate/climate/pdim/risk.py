"""PDIM Stage-1 scalar response functions, ported from Hackathon-BE/src/utils/riskCalculator.ts.

Also home of the three JS-parity helpers every other module needs (`js_round`,
`to_fixed`, `js_iso`): the legacy outputs are the API contract, and Python's
`round`/`format`/`isoformat` differ from `Math.round`/`toFixed`/`toISOString` at
exactly the ties and formats a payload diff would catch.
"""

import math
from datetime import UTC, datetime, timedelta
from decimal import ROUND_HALF_UP, Decimal

from climate.pdim.constants import PDIM_S1, get_aqi_level

_EPOCH = datetime(1970, 1, 1, tzinfo=UTC)


# ── JS parity helpers ────────────────────────────────────────────────────────
def js_round(x: float) -> int:
    """`Math.round`: nearest integer, ties toward +inf (Python `round` is banker's)."""
    r = math.floor(x)
    return r + 1 if x - r >= 0.5 else r


def to_fixed(x: float, digits: int) -> str:
    """`Number.prototype.toFixed`: exact decimal value of the double, ties away from zero."""
    return format(Decimal(x).quantize(Decimal(1).scaleb(-digits), rounding=ROUND_HALF_UP), "f")


def as_utc(now: datetime) -> datetime:
    return now.replace(tzinfo=UTC) if now.tzinfo is None else now.astimezone(UTC)


def js_iso(now: datetime) -> str:
    """`Date.prototype.toISOString`: `YYYY-MM-DDTHH:MM:SS.sssZ`. Naive datetimes are taken as UTC."""
    u = as_utc(now)
    return u.strftime("%Y-%m-%dT%H:%M:%S.") + f"{u.microsecond // 1000:03d}Z"


def epoch_ms(now: datetime) -> int:
    """`Date.now()` for a given instant."""
    return (as_utc(now) - _EPOCH) // timedelta(milliseconds=1)


def clamp(value: float, lo: float, hi: float) -> float:
    return min(max(value, lo), hi)


# ── PDIM Section 4.2 ─────────────────────────────────────────────────────────
def flood_risk_score(
    rainfall: float,
    imperviousness: float,
    drainage_capacity: float,
    terrain_sensitivity: float = PDIM_S1["flood"]["terrainDefault"],
) -> float:
    """R_f(i) = w1·P̃ + w2·T̃ + w3·Ĩ − w4·D̃, clamped to [0, 1]."""
    f = PDIM_S1["flood"]
    p = clamp(rainfall / f["rainRefMmH"], 0, 1)
    t = clamp(terrain_sensitivity, 0, 1)
    i = clamp(imperviousness, 0, 1)
    d = clamp(drainage_capacity, 0, 1)
    return clamp(f["w1"] * p + f["w2"] * t + f["w3"] * i - f["w4"] * d, 0, 1)


def flood_risk_level(score: float) -> str:
    """Decision band b for Θ = (0.25, 0.50, 0.75)."""
    t = PDIM_S1["flood"]["thresholds"]
    if score >= t["high"]:
        return "critical"
    if score >= t["medium"]:
        return "high"
    if score >= t["low"]:
        return "medium"
    return "low"


def wind_norm(wind_speed_kmh: float) -> float:
    """W̃ = min(wind / 30 km/h, 1)."""
    return clamp(wind_speed_kmh / PDIM_S1["aqi"]["windRefKmH"], 0, 1)


def rain_norm(rainfall_mmh: float) -> float:
    """P̃ = min(P / 50 mm/h, 1)."""
    return clamp(rainfall_mmh / PDIM_S1["flood"]["rainRefMmH"], 0, 1)


def aqi_nowcast_step(
    aqi: float,
    wind_speed_kmh: float,
    rainfall_mmh: float,
    gamma_wind: float = PDIM_S1["aqi"]["gammaWind"],
    gamma_rain: float = PDIM_S1["aqi"]["gammaRain"],
) -> float:
    """AQI(t+1) = AQI(t) · (1 − γ_w·W̃) · (1 − γ_p·P̃). γ default to S1; S2 passes the fitted ones (§H)."""
    return aqi * (1 - gamma_wind * wind_norm(wind_speed_kmh)) * (1 - gamma_rain * rain_norm(rainfall_mmh))


def heat_index(temperature: float, humidity: float) -> float:
    """Rothfusz heat index, °C in and out."""
    T = temperature * 9 / 5 + 32
    R = humidity
    if T < 80:
        hi = 0.5 * (T + 61.0 + (T - 68.0) * 1.2 + R * 0.094)
        return (hi - 32) * 5 / 9
    HI = (
        -42.379
        + 2.04901523 * T
        + 10.14333127 * R
        - 0.22475541 * T * R
        - 0.00683783 * T * T
        - 0.05481717 * R * R
        + 0.00122874 * T * T * R
        + 0.00085282 * T * R * R
        - 0.00000199 * T * T * R * R
    )
    if R < 13 and 80 <= T <= 112:
        HI -= ((13 - R) / 4) * math.sqrt((17 - abs(T - 95)) / 17)
    elif R > 85 and 80 <= T <= 87:
        HI += ((R - 85) / 10) * ((87 - T) / 5)
    return (HI - 32) * 5 / 9


def effective_temp(temperature: float, humidity: float, urban_density: float) -> float:
    """Heat index plus the UHI bonus (density × 3.5 °C)."""
    return heat_index(temperature, humidity) + urban_density * PDIM_S1["heat"]["uhiMaxDeg"]


def aqi_level(aqi: float) -> str:
    return get_aqi_level(aqi)


def estimated_depth_m(score: float) -> float:
    """Screening-level inundation depth (m), 2 decimals."""
    return js_round(score * PDIM_S1["flood"]["depthMaxM"] * 100) / 100
