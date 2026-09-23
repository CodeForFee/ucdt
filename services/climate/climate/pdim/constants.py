"""PDIM Stage-1 coefficients — the SINGLE source of truth for every formula in UCDT.

Per Section 4.2 of the PO-UCDT manuscript. Ported verbatim from the legacy
Hackathon-BE/src/utils/constants.ts; tests/pdim asserts numeric parity with that
module. The web client no longer mirrors these values: any number derived from
them is computed here and served over the API (DP3).
"""

from typing import Final

RISK_THRESHOLDS: Final = {
    "flood": {"low": 0.25, "medium": 0.5, "high": 0.75},
    "aqi": {
        "good": 50,
        "moderate": 100,
        "unhealthySensitive": 150,
        "unhealthy": 200,
        "veryUnhealthy": 300,
    },
    "heat": {"moderate": 37, "high": 40},
}

PDIM_S1: Final = {
    "flood": {
        # R_f(i) = w1*P̃ + w2*T̃ + w3*Ĩ − w4*D̃, with Σw over the ADDITIVE terms = 1
        # (w1 + w2 + w3 = 1); w4 is the drainage mitigation credit.
        "w1": 0.45,  # P̃  rainfall intensity — dominant driver of urban pluvial flooding in HCMC
        "w2": 0.30,  # T̃  terrain sensitivity (low-lying elevation/slope)
        "w3": 0.25,  # Ĩ  imperviousness (soil-saturation proxy in Stage 1)
        "w4": 0.15,  # D̃  drainage capacity (subtractive)
        "rainRefMmH": 50,  # P̃ = min(P / 50 mm/h, 1) — extreme-rain reference bound
        # City-aggregate T̃ only. Every flood zone carries terrain 0.60, so this value
        # is reached solely by the city-level score, never by a per-zone score.
        "terrainDefault": 0.5,
        "thresholds": RISK_THRESHOLDS["flood"],  # Θ = (0.25, 0.50, 0.75)
        "depthMaxM": 0.8,  # estimated inundation depth = R_f × 0.8 m (screening-level)
    },
    "heat": {
        "alphaGreenDegPerPct": 0.15,  # ΔT = −α·ΔG: −0.15 °C per +1 pp green cover
        "uhiMaxDeg": 3.5,  # UHI bonus = 3.5 °C × urban density (0–1)
        "densityBaseline": 0.8,  # reference density the what-if deltas are measured against
    },
    "aqi": {
        "betaTrafficPerPct": 0.3,  # ΔAQI = −β·ΔV: −0.3 AQI per 1% traffic reduction
        "greenPerPct": 0.15,  # S1 heuristic: −0.15 AQI per +1 pp green cover
        "gammaWind": 0.05,  # γ_w dispersion coefficient in the S1 nowcast (per hour at W̃=1)
        "gammaRain": 0.15,  # γ_p washout coefficient in the S1 nowcast (per hour at P̃=1)
        "windRefKmH": 30,  # W̃ = min(wind / 30 km/h, 1)
    },
    # +0.3% effective drainage capacity per +1% additional green coverage
    "greenToDrainPerPct": 0.003,
}

# On a dry day (measured rainfall 0) a rainfall scenario has nothing to scale, so the
# what-if assumes this reference shower instead.
DRY_DAY_REFERENCE_RAIN_MM_H: Final = 20

DEFAULT_CITY: Final = {
    "id": "hcmc",
    "name": "TP. Hồ Chí Minh",
    "lat": 10.7769,
    "lng": 106.7009,
}

# AQI display bands. `code` is the machine-readable level; `label` is the Vietnamese
# display string served by the API. One table, so a threshold can never drift.
AQI_CATEGORIES: Final = (
    {"max": 50, "code": "good", "label": "Tốt", "color": "#00e400"},
    {"max": 100, "code": "moderate", "label": "Trung bình", "color": "#ffff00"},
    {"max": 150, "code": "unhealthy_sensitive", "label": "Không tốt cho nhóm nhạy cảm", "color": "#ff7e00"},
    {"max": 200, "code": "unhealthy", "label": "Không lành mạnh", "color": "#ff0000"},
    {"max": 300, "code": "very_unhealthy", "label": "Rất không lành mạnh", "color": "#8f3f97"},
    {"max": 500, "code": "hazardous", "label": "Nguy hiểm", "color": "#7e0023"},
)


def _aqi_band(aqi: float) -> dict:
    return next((cat for cat in AQI_CATEGORIES if aqi <= cat["max"]), AQI_CATEGORIES[-1])


def get_aqi_level(aqi: float) -> str:
    """Machine-readable AQI level code."""
    return _aqi_band(aqi)["code"]


def get_aqi_category(aqi: float) -> str:
    """Vietnamese display label for an AQI value."""
    return _aqi_band(aqi)["label"]
