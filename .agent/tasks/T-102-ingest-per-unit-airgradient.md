---
id: T-102
title: ingestion: per-unit weather + AirGradient open network
owner: claude-opus-5 (subagent)
scope: services/climate/climate/ingest/**, services/climate/tests/ingest/**
exit: `uv run pytest tests/ingest -q` green with fake HTTP; one live smoke call recorded in the task file
phase: done
blocked:
created: 2026-09-24T0330Z
sprint: S-002
issue: 47
---

## Plan
Spec §I. fetch_forecast_multi(coords) (one Open-Meteo request, current + hourly, per-location hour alignment reusing local_time/transform_forecast); AirGradient client (bbox filter, pm02 → raw AQ dict, observedAt, location id/name); keep IQAir/AQICN fallbacks.

## Execute
- `climate/ingest/weather.py`: `fetch_forecast_multi` (one request, comma-separated lat/lng,
  same hourly vars + current_weather + forecast_days=2; list or single object → list in input
  order; count mismatch raises). `fetch_forecast` now delegates to it with one coordinate (same
  request params, same return). `unit_points()` (63 units + "city") and `fetch_weather_by_unit`
  (dedupe coords → one call → `transform_forecast` per location → map back to unit ids).
- `climate/ingest/airgradient.py`: `fetch_airgradient` (bbox, stale > 2 h, null/negative pm02,
  name guard, never raises).
- `climate/ingest/names.py`: the §A.1 guard (regex + 12 former district names), matched on
  diacritic-folded, case-folded text.
- `climate/ingest/air.py` (IQAir/AQICN fallbacks) untouched.

## Review
## Test
- `uv run ruff check . && uv run ruff format --check . && uv run pytest -q` → 191 passed
  (whole suite; 24 new tests in `tests/ingest/test_weather_multi.py`, `tests/ingest/test_airgradient.py`).
- Live smoke 2026-09-24T03:22Z (httpx timeout 8, as the worker):
  - Weather: ONE Open-Meteo request, 41 unique coordinates (63 units + city) → 64 entries,
    0.95 s. First forecast hour 2026-09-24T10:00 (= 03:22Z in HCMC, B-012 holds), 24 hours each.
    Samples (T °C / RH % / P mm/h): city 28.7 / 79 / 0.0 · cuchi 28.4 / 80 / 0.1 ·
    cangio 28.8 / 76 / 0.3 · gz-q8-rach-ong 29.0 / 79 / 0.0.
  - AirGradient: 1 HCMC station — `ag:82509` "CMT8" (10.78533, 106.67029), pm25 20.3,
    observedAt 2026-09-24T03:21:12.000Z. The world payload is ~1.5 MB / 2,821 locations and took
    11.1 s (the 8 s httpx timeout is per read, so it passed).

## Handoff
Functions T-103 calls (all in `climate.ingest`):

```python
# climate/ingest/weather.py
async def fetch_weather_by_unit(client, timezone: str, now: datetime,
                                points: dict[str, tuple[float, float]] | None = None) -> dict[str, dict]
# -> {unit_id: WeatherResponse, ..., "city": WeatherResponse}; 64 keys by default (every id in
#    ALL_UNITS + "city"). WeatherResponse = transform_forecast output:
#    {"current": {temperature, feelsLike, humidity, rainfall, windSpeed, windDirection, condition, timestamp},
#     "forecast": [{hour, temperature, rainfall, windSpeed, stormProbability}] (≤24, from the local hour)}
#    Raises (HTTP error, count mismatch, malformed CITY) → worker skips the run as today.
#    A malformed non-city location falls back to the city WeatherResponse (warning logged).
#    Units sharing a coordinate share the SAME dict object — copy before mutating.
async def fetch_forecast_multi(client, coords: list[tuple[float, float]], timezone: str) -> list[dict]
# -> raw Open-Meteo forecasts in coords order. Lower level; T-103 should not need it.
def unit_points() -> dict[str, tuple[float, float]]    # unit id -> (lat, lng), plus "city"
async def fetch_forecast(client, lat, lng, timezone) -> dict   # unchanged contract (current worker)

# climate/ingest/airgradient.py
async def fetch_airgradient(client, now: datetime) -> list[dict]
# -> [{"id": "ag:<locationId>", "name": str, "lat": float, "lng": float,
#      "pm25": float (µg/m³, from pm02), "observedAt": "YYYY-MM-DDTHH:MM:SS.sssZ", "source": "airgradient"}]
#    Never raises; [] on HTTP/network/decode failure. No AQI here (processing converts PM2.5 → AQI).
#    Nearest-AQI-point mapping (§A.4) is NOT done here.
```

- Name guard: `climate/ingest/names.py` (`is_admin_label`, `fold`, `FORMER_DISTRICTS`).
  T-101 has a similar guard; the lead will dedupe. Folding makes it also flag "Quán…"/"Huyền…"
  (→ generic station name, the safe direction).
- The AirGradient call is slow (~11 s, 1.5 MB world payload): run it inside the worker's
  `asyncio.gather`, not sequentially.
