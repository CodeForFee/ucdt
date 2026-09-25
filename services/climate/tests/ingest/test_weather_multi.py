from datetime import UTC, datetime

import httpx
import pytest
import respx

from climate.ingest import weather
from climate.spatial.units import ALL_UNITS

NOW = datetime(2026, 9, 24, 3, 0, tzinfo=UTC)  # 10:00 in HCMC
HCMC = 7 * 3600


def raw(offset: int, base: float) -> dict:
    """48 local hours from 2026-09-24T00:00; temperature at hour i = base + i."""
    times = [f"2026-09-{24 + i // 24}T{i % 24:02d}:00" for i in range(48)]
    return {
        "utc_offset_seconds": offset,
        "current_weather": {"weathercode": 0},
        "hourly": {
            "time": times,
            "temperature_2m": [base + i for i in range(48)],
            "precipitation": [0.0] * 48,
            "windspeed_10m": [5.0] * 48,
            "winddirection_10m": [90] * 48,
            "relativehumidity_2m": [70] * 48,
        },
    }


@respx.mock
async def test_multi_sends_one_request_and_keeps_list_order():
    route = respx.get(weather.FORECAST_URL).respond(json=[raw(HCMC, 10), raw(HCMC, 20)])
    async with httpx.AsyncClient() as c:
        got = await weather.fetch_forecast_multi(c, [(10.1, 106.1), (10.2, 106.2)], "Asia/Ho_Chi_Minh")
    assert [g["hourly"]["temperature_2m"][0] for g in got] == [10, 20]
    assert route.call_count == 1
    p = route.calls.last.request.url.params
    assert p["latitude"] == "10.1,10.2" and p["longitude"] == "106.1,106.2"
    assert p["forecast_days"] == "2" and p["current_weather"] == "true" and p["hourly"] == weather.HOURLY


@respx.mock
async def test_multi_wraps_single_object_and_rejects_count_mismatch():
    respx.get(weather.FORECAST_URL).respond(json=raw(HCMC, 10))
    async with httpx.AsyncClient() as c:
        assert await weather.fetch_forecast_multi(c, [(10.1, 106.1)], "Asia/Ho_Chi_Minh") == [raw(HCMC, 10)]
        with pytest.raises(ValueError):
            await weather.fetch_forecast_multi(c, [(10.1, 106.1), (10.2, 106.2)], "Asia/Ho_Chi_Minh")


@respx.mock
async def test_by_unit_dedupes_coords_and_aligns_hour_per_location():
    points = {"a": (10.1, 106.1), "b": (10.2, 106.2), "a2": (10.1, 106.1), "city": (10.3, 106.3)}
    # b is reported in UTC (offset 0), the others in HCMC time: each must match its OWN local hour.
    route = respx.get(weather.FORECAST_URL).respond(json=[raw(HCMC, 100), raw(0, 200), raw(HCMC, 300)])
    async with httpx.AsyncClient() as c:
        got = await weather.fetch_weather_by_unit(c, "Asia/Ho_Chi_Minh", NOW, points)
    assert route.calls.last.request.url.params["latitude"] == "10.1,10.2,10.3"
    assert set(got) == {"a", "b", "a2", "city"}
    assert got["a"]["forecast"][0]["hour"] == "2026-09-24T10:00" and got["a"]["current"]["temperature"] == 110
    assert got["b"]["forecast"][0]["hour"] == "2026-09-24T03:00" and got["b"]["current"]["temperature"] == 203
    assert got["a2"] == got["a"]
    assert got["city"]["current"]["temperature"] == 310


@respx.mock
async def test_by_unit_malformed_location_falls_back_to_city():
    points = {"a": (10.1, 106.1), "b": (10.2, 106.2), "city": (10.3, 106.3)}
    no_hours = {**raw(HCMC, 200), "hourly": {"time": []}}
    respx.get(weather.FORECAST_URL).respond(json=[{"error": True}, no_hours, raw(HCMC, 300)])
    async with httpx.AsyncClient() as c:
        got = await weather.fetch_weather_by_unit(c, "Asia/Ho_Chi_Minh", NOW, points)
    assert got["a"] == got["b"] == got["city"]
    assert got["city"]["current"]["temperature"] == 310


@respx.mock
async def test_by_unit_malformed_city_raises():
    respx.get(weather.FORECAST_URL).respond(json=[raw(HCMC, 100), {"error": True}])
    async with httpx.AsyncClient() as c:
        with pytest.raises(ValueError):
            await weather.fetch_weather_by_unit(
                c, "Asia/Ho_Chi_Minh", NOW, {"a": (10.1, 106.1), "city": (10.3, 106.3)}
            )


def test_unit_points_cover_every_unit_and_the_city():
    points = weather.unit_points()
    assert set(points) == {u["id"] for u in ALL_UNITS} | {"city"}
    assert len(points) == 64
