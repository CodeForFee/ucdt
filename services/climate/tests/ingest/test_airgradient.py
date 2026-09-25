from datetime import UTC, datetime

import httpx
import pytest
import respx

from climate.ingest import airgradient
from climate.ingest.names import is_admin_label

NOW = datetime(2026, 9, 24, 3, 30, tzinfo=UTC)


def row(lid, name="CMT8", lat=10.78533, lng=106.67029, pm02=17.2, ts="2026-09-24T03:19:12.000Z"):
    return {
        "locationId": lid,
        "locationName": name,
        "publicLocationName": name,
        "latitude": lat,
        "longitude": lng,
        "pm02": pm02,
        "timestamp": ts,
    }


@respx.mock
async def test_filters_and_maps():
    route = respx.get(airgradient.AIRGRADIENT_URL).respond(
        json=[
            row(82509),
            row(1, lat=18.96, lng=98.91),  # Chiang Mai: outside the bbox
            row(2, ts="2026-09-24T01:29:00.000Z"),  # 2 h 1 min old
            row(3, pm02=None),
            row(4, pm02=-1),
            row(5, name="Quận 1"),
            {"locationId": 6},  # malformed: skipped, not raised
            row(7, ts="2026-09-24T01:31:00.000Z", pm02=0),  # 1 h 59 min old, zero is a reading
        ]
    )
    async with httpx.AsyncClient() as c:
        got = await airgradient.fetch_airgradient(c, NOW)
    assert route.calls.last.request.headers["User-Agent"] == airgradient.USER_AGENT
    assert got == [
        {
            "id": "ag:82509",
            "name": "CMT8",
            "lat": 10.78533,
            "lng": 106.67029,
            "pm25": 17.2,
            "observedAt": "2026-09-24T03:19:12.000Z",
            "source": "airgradient",
        },
        {**got[1], "id": "ag:5", "name": "Trạm AirGradient 5"},
        {**got[2], "id": "ag:7", "pm25": 0, "observedAt": "2026-09-24T01:31:00.000Z"},
    ]


@pytest.mark.parametrize("fail", [httpx.ConnectError("down"), 503, "not json"])
@respx.mock
async def test_upstream_failure_returns_empty(fail):
    r = respx.get(airgradient.AIRGRADIENT_URL)
    if isinstance(fail, Exception):
        r.side_effect = fail
    elif isinstance(fail, int):
        r.respond(fail)
    else:
        r.respond(text=fail)
    async with httpx.AsyncClient() as c:
        assert await airgradient.fetch_airgradient(c, NOW) == []


@pytest.mark.parametrize(
    "name",
    ["Quận 1", "quan 3", "HUYỆN Nhà Bè", "District 7", "Q.1", "Q. 10", "Bình Thạnh", "binh  thanh", "Củ Chi"],
)
def test_guard_flags_admin_labels(name):
    assert is_admin_label(name)


@pytest.mark.parametrize("name", ["CMT8", "Bến Nghé", "Linh Trung", "Tân Phước", "Nhà Bèo"])
def test_guard_keeps_toponyms(name):
    assert not is_admin_label(name)
