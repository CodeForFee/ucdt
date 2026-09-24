"""Algorithm 1 — model maturity per hazard (spec §H). Pure: the caller loads the stored history.

active(h) = S1 unless promoted. Only the AQI nowcast can reach S2 in this deployment: its γ_w, γ_p
are re-estimated on the open-network station series V by OLS without intercept on
    y_t = ln(AQI_{t+1}/AQI_t) ≈ −γ_w·W̃_t − γ_p·P̃_t
(earliest 70 % of V), and S2 is active while its one-step-ahead holdout MAE (latest 30 %) beats
S1's by δ. The evaluation is stateless, so a later failing evaluation demotes (line 9).
"""

import math
from collections import defaultdict
from datetime import datetime, timedelta
from statistics import NormalDist

from climate.pdim.constants import PDIM_S1
from climate.pdim.risk import as_utc, js_iso, rain_norm, wind_norm

WINDOW = timedelta(days=14)
DELTA_AQI = 2
MIN_PAIRS = 168
MIN_SPAN = timedelta(days=7)
TRAIN_SHARE = 0.7
S3_MONTHS = 12
S1 = (PDIM_S1["aqi"]["gammaWind"], PDIM_S1["aqi"]["gammaRain"])
MODEL_S1, MODEL_S2_AQI = "pdim-s1", "pdim-s2-aqi"
_H = timedelta(hours=1)


def _hour(t: datetime) -> datetime:
    # UTC hour == Asia/Ho_Chi_Minh local hour: the offset is a whole +7 h.
    return as_utc(t).replace(minute=0, second=0, microsecond=0)


def validation_series(readings: list[dict], aqi_inputs: list[dict]) -> list[tuple]:
    """V: [(hour t, station, AQI_t, AQI_{t+1}, W̃_t, P̃_t)] sorted by t, then station.

    `readings`: aqi_obs rows of the open network {location_id, fetched_at, aqi}; the hourly AQI is
    the mean of a station's readings in that hour. `aqi_inputs`: aqi snapshot inputs, oldest first,
    {computed_at, pointWeather: {pointId: {windSpeed, rainfall}}, stationMap: {station: pointId}};
    W̃, P̃ are those of the station's mapped point in hour t (last run of the hour wins)."""
    by_hour = defaultdict(list)
    for r in readings:
        by_hour[(r["location_id"], _hour(r["fetched_at"]))].append(r["aqi"])
    aqi_h = {k: sum(v) / len(v) for k, v in by_hour.items()}
    weather, station_map = {}, {}
    for row in aqi_inputs:
        h = _hour(row["computed_at"])
        for pid, w in (row.get("pointWeather") or {}).items():
            weather[(pid, h)] = (wind_norm(w["windSpeed"]), rain_norm(w["rainfall"]))
        station_map.update(row.get("stationMap") or {})
    series = []
    for (sid, h), a0 in aqi_h.items():
        a1 = aqi_h.get((sid, h + _H))
        w = weather.get((station_map.get(sid), h))
        if a1 and a0 > 0 and a1 > 0 and w:
            series.append((h, sid, a0, a1, *w))
    series.sort()
    return series


def t_quantile_975(df: int) -> float:
    """Student-t 0.975 quantile by the Cornish–Fisher expansion (no scipy); < 1e-4 off for df ≥ 10."""
    z = NormalDist().inv_cdf(0.975)
    g = (
        (z**3 + z) / 4,
        (5 * z**5 + 16 * z**3 + 3 * z) / 96,
        (3 * z**7 + 19 * z**5 + 17 * z**3 - 15 * z) / 384,
        (79 * z**9 + 776 * z**7 + 1482 * z**5 - 1920 * z**3 - 945 * z) / 92160,
    )
    return z + sum(gi / df ** (i + 1) for i, gi in enumerate(g))


def fit_gammas(rows: list[tuple]) -> dict | None:
    """OLS without intercept of y = ln(A1/A0) on (−W̃, −P̃); None when the design is singular
    (e.g. no rain in the training span) or n < 3. Estimates clamped to [0, 1]; the 95 % CI is
    estimate ± t·SE around the unclamped estimate."""
    n = len(rows)
    if n < 3:
        return None
    sww = spp = swp = swy = spy = 0.0
    for _, _, a0, a1, w, p in rows:
        y = math.log(a1 / a0)
        sww += w * w
        spp += p * p
        swp += w * p
        swy += w * y
        spy += p * y
    det = sww * spp - swp * swp
    if det <= 1e-12 * sww * spp or det <= 0:
        return None
    # Normal equations for regressors (−W̃, −P̃): XᵀX = [[Σw², Σwp], [Σwp, Σp²]], Xᵀy = (−Σwy, −Σpy).
    gw = (spp * -swy - swp * -spy) / det
    gp = (sww * -spy - swp * -swy) / det
    rss = 0.0
    for _, _, a0, a1, w, p in rows:
        rss += (math.log(a1 / a0) + gw * w + gp * p) ** 2
    s2 = rss / (n - 2)
    t = t_quantile_975(n - 2)
    out = {}
    for key, est, var in (("gammaWind", gw, spp / det), ("gammaRain", gp, sww / det)):
        se = math.sqrt(s2 * var)
        out[key] = {
            "value": min(max(est, 0), 1),
            "estimate": est,
            "se": se,
            "ci95": [est - t * se, est + t * se],
        }
    return out


def holdout_mae(rows: list[tuple], gamma_wind: float, gamma_rain: float) -> float | None:
    """Mean |AQI_t·(1 − γ_w·W̃_t)(1 − γ_p·P̃_t) − AQI_{t+1}| — the one-step-ahead nowcast error."""
    if not rows:
        return None
    return sum(
        abs(a0 * (1 - gamma_wind * w) * (1 - gamma_rain * p) - a1) for _, _, a0, a1, w, p in rows
    ) / len(rows)


def _s3(oldest: datetime | None, now: datetime) -> dict:
    months = 0.0 if oldest is None else (as_utc(now) - as_utc(oldest)).days / 30.44
    return {
        "eligible": months >= S3_MONTHS,
        "reason": f"needs ≥ {S3_MONTHS} months of archived data (lines 5–7 not reached in this deployment)",
        "criteria": [{"name": "archiveMonths", "current": round(months, 1), "required": S3_MONTHS}],
    }


def _no_s2(hazard: str, reason: str, series: str, oldest, now) -> dict:
    return {
        "hazard": hazard,
        "active": "S1",
        "modelVersion": MODEL_S1,
        "stages": {
            "S1": {"eligible": True, "criteria": []},
            "S2": {
                "eligible": False,
                "reason": reason,
                "criteria": [{"name": series, "current": 0, "required": 1}],
            },
            "S3": _s3(oldest, now),
        },
        "s1MaeHoldout": None,
        "s2": None,
    }


def evaluate(
    readings: list[dict], aqi_inputs: list[dict], oldest_snapshot: datetime | None, now: datetime
) -> dict:
    """Line 8 exposure: per hazard the active stage, each stage's criteria (current vs required),
    the S1 holdout MAE where V exists, S2 estimates with 95 % CIs and MAE when fitted; δ, W, evaluatedAt."""
    v = validation_series(readings, aqi_inputs)
    n = len(v)
    span = (v[-1][0] + _H - v[0][0]) if v else timedelta(0)
    eligible = n >= MIN_PAIRS and span >= MIN_SPAN
    cut = int(n * TRAIN_SHARE)
    train, hold = v[:cut], v[cut:]
    s1_mae = holdout_mae(hold, *S1)
    s2 = None
    promoted = False
    if eligible and (fit := fit_gammas(train)):
        gw, gp = fit["gammaWind"]["value"], fit["gammaRain"]["value"]
        s2_mae = holdout_mae(hold, gw, gp)
        promoted = s2_mae is not None and s1_mae is not None and s2_mae <= s1_mae - DELTA_AQI
        s2 = {
            "estimates": fit,
            "maeHoldout": s2_mae,
            "nTrain": len(train),
            "nHoldout": len(hold),
            "promoted": promoted,
        }
    if not eligible:
        reason = (
            f"needs ≥ {MIN_PAIRS} consecutive-hour station pairs spanning ≥ {MIN_SPAN.days} days within W"
        )
    elif s2 is None:
        reason = "S2 fit failed: singular design (no variation in W̃ or P̃ over the training span)"
    else:
        reason = "MAE_holdout(S2) ≤ MAE_holdout(S1) − δ" + (" holds" if promoted else " does not hold")
    aqi = {
        "hazard": "aqi",
        "active": "S2" if promoted else "S1",
        "modelVersion": MODEL_S2_AQI if promoted else MODEL_S1,
        "stages": {
            "S1": {"eligible": True, "criteria": []},
            "S2": {
                "eligible": eligible,
                "reason": reason,
                "criteria": [
                    {"name": "consecutiveHourPairs", "current": n, "required": MIN_PAIRS},
                    {
                        "name": "spanDays",
                        "current": round(span / timedelta(days=1), 2),
                        "required": MIN_SPAN.days,
                    },
                ],
            },
            "S3": _s3(oldest_snapshot, now),
        },
        "s1MaeHoldout": s1_mae,
        "s2": s2,
    }
    return {
        "evaluatedAt": js_iso(now),
        "windowDays": WINDOW.days,
        "deltaAqi": DELTA_AQI,
        "hazards": [
            _no_s2(
                "flood",
                "w₁…w₄ need an observed inundation / gauge series; none is in the data layer",
                "inundationSeries",
                oldest_snapshot,
                now,
            ),
            _no_s2(
                "heat",
                "α and u need observed air / land-surface temperature at the cells (Landsat LST is Stage 2)",
                "lstSeries",
                oldest_snapshot,
                now,
            ),
            aqi,
        ],
    }


def nowcast_gammas(evaluation: dict) -> tuple[tuple[float, float], str]:
    """((γ_w, γ_p), model_version) the aqi snapshot uses: the fitted pair while S2 is active."""
    aqi = next(h for h in evaluation["hazards"] if h["hazard"] == "aqi")
    if aqi["active"] != "S2":
        return S1, MODEL_S1
    est = aqi["s2"]["estimates"]
    return (est["gammaWind"]["value"], est["gammaRain"]["value"]), MODEL_S2_AQI
