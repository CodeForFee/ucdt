import json
from datetime import datetime
from pathlib import Path

import httpx
import pytest
import respx

from climate.config import Settings
from climate.ingest import air, weather

FIXTURE = json.loads((Path(__file__).parents[1] / "fixtures" / "parity.json").read_text(encoding="utf-8"))
SCENARIOS = {s["id"]: s for s in FIXTURE["scenarios"]}
HCMC = 7 * 3600


@pytest.mark.parametrize("sid", sorted(SCENARIOS))
def test_transform_matches_legacy_when_offset_is_zero(sid):
    # Legacy matched the UTC hour; with a zero offset the fixed code does the same, so the
    # port of everything else in transformOpenMeteoResponse is checked against legacy output.
    s = SCENARIOS[sid]
    raw = {**s["inputs"]["openMeteoForecast"], "utc_offset_seconds": 0}
    assert weather.transform_forecast(raw, datetime.fromisoformat(s["now"])) == s["inputs"]["weather"]


def test_b012_current_hour_is_hcmc_local():
    s = SCENARIOS["dry-clear-clean"]  # now 03:00Z = 10:00 in HCMC
    raw = {**s["inputs"]["openMeteoForecast"], "utc_offset_seconds": HCMC}
    got = weather.transform_forecast(raw, datetime.fromisoformat(s["now"]))
    hourly = raw["hourly"]
    assert got["forecast"][0]["hour"] == "2026-02-10T10:00"  # legacy: "2026-02-10T03:00"
    assert got["current"]["temperature"] == hourly["temperature_2m"][10]
    assert got["current"]["humidity"] == hourly["relativehumidity_2m"][10]
    assert got["current"]["timestamp"] == "2026-02-10T03:00:00.000Z"


def test_b012_pre_dawn_no_longer_falls_back_to_midnight():
    s = SCENARIOS["pre-dawn-idx-fallback"]  # 22:30Z = 05:30 local next day; legacy fell back to idx 0
    raw = {**s["inputs"]["openMeteoForecast"], "utc_offset_seconds": HCMC}
    got = weather.transform_forecast(raw, datetime.fromisoformat(s["now"]))
    assert got["forecast"][0]["hour"] == "2026-09-24T05:00"


@respx.mock
async def test_fetch_forecast_requests_two_local_days():
    route = respx.get(weather.FORECAST_URL).respond(json={"utc_offset_seconds": HCMC})
    async with httpx.AsyncClient() as c:
        assert await weather.fetch_forecast(c, 10.7769, 106.7009, "Asia/Ho_Chi_Minh") == {
            "utc_offset_seconds": HCMC
        }
    params = route.calls.last.request.url.params
    assert params["timezone"] == "Asia/Ho_Chi_Minh" and params["forecast_days"] == "2"


@respx.mock
async def test_fetch_forecast_raises_on_http_error():
    respx.get(weather.FORECAST_URL).respond(503)
    async with httpx.AsyncClient() as c:
        with pytest.raises(httpx.HTTPStatusError):
            await weather.fetch_forecast(c, 10.7769, 106.7009, "Asia/Ho_Chi_Minh")


@respx.mock
async def test_fetch_aq_open_meteo_first():
    respx.get(air.OPEN_METEO_AQ_URL).respond(
        json={"current": {"pm2_5": 8.4, "pm10": 13.4, "ozone": 70, "nitrogen_dioxide": 11}}
    )
    iq = respx.get(air.IQAIR_URL)
    async with httpx.AsyncClient() as c:
        raw = await air.fetch_aq(c, 10.7769, 106.7009, Settings(iqair_api_key="k"))
    assert raw == {"aqi": 35, "pm25": 8.4, "pm10": 13.4, "o3": 70, "no2": 11, "source": "openmeteo"}
    assert not iq.called


@respx.mock
async def test_fetch_aq_fallbacks_only_with_keys():
    respx.get(air.OPEN_METEO_AQ_URL).respond(500)
    iq = respx.get(air.IQAIR_URL).respond(
        json={"status": "success", "data": {"current": {"pollution": {"aqius": 100}}}}
    )
    cn = respx.get(url__startswith="https://api.waqi.info/feed/geo:").respond(
        json={"status": "ok", "data": {"aqi": "-", "iaqi": {}}}
    )
    async with httpx.AsyncClient() as c:
        assert await air.fetch_aq(c, 1.0, 2.0, Settings(iqair_api_key="", aqicn_token="")) is None
        assert not iq.called and not cn.called

        assert await air.fetch_aq(c, 1.0, 2.0, Settings(iqair_api_key="k", aqicn_token="")) == {
            "aqi": 100,
            "pm25": 35.0,
            "pm10": 55.00000000000001,
            "o3": 0,
            "no2": 0,
            "source": "iqair",
        }

        iq.respond(json={"status": "fail", "data": {"message": "limit"}})
        # AQICN "-" (no data) is not a number: every source failed.
        assert await air.fetch_aq(c, 1.0, 2.0, Settings(iqair_api_key="k", aqicn_token="t")) is None
        cn.respond(json={"status": "ok", "data": {"aqi": 88, "iaqi": {"pm25": {"v": 30}}}})
        assert await air.fetch_aq(c, 1.0, 2.0, Settings(iqair_api_key="k", aqicn_token="t")) == {
            "aqi": 88,
            "pm25": 30,
            "pm10": 0,
            "o3": 0,
            "no2": 0,
            "source": "aqicn",
        }
