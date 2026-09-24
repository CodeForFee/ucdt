"""AirGradient open monitoring network (spec §I.3): current PM2.5 at every public location in the
HCMC bbox. No key. Readings only — PM2.5 -> AQI happens in processing."""

import logging
from datetime import datetime, timedelta

import httpx

from climate.ingest.names import is_admin_label
from climate.pdim.risk import as_utc, js_iso

log = logging.getLogger(__name__)

AIRGRADIENT_URL = "https://api.airgradient.com/public/api/v1/world/locations/measures/current"
USER_AGENT = "ucdt-research/0.1 (github.com/CodeForFee/ucdt)"
LAT = (10.3, 11.2)
LNG = (106.3, 107.1)
MAX_AGE = timedelta(hours=2)


def _reading(r: dict, now: datetime) -> dict | None:
    lat, lng, pm = r["latitude"], r["longitude"], r["pm02"]
    if not (LAT[0] <= lat <= LAT[1] and LNG[0] <= lng <= LNG[1]):
        return None
    if pm is None or pm < 0:
        return None
    observed = as_utc(datetime.fromisoformat(r["timestamp"]))
    if now - observed > MAX_AGE:
        return None
    lid = r["locationId"]
    name = r.get("publicLocationName") or r.get("locationName") or ""
    if not name.strip() or is_admin_label(name):
        name = f"Trạm AirGradient {lid}"
    return {
        "id": f"ag:{lid}",
        "name": name,
        "lat": lat,
        "lng": lng,
        "pm25": pm,
        "observedAt": js_iso(observed),
        "source": "airgradient",
    }


async def fetch_airgradient(client: httpx.AsyncClient, now: datetime) -> list[dict]:
    """[{id, name, lat, lng, pm25 (µg/m³), observedAt, source}] for fresh readings in the bbox.

    Never raises: an HTTP/network/decode failure logs and returns [], a malformed row is skipped."""
    try:
        res = await client.get(AIRGRADIENT_URL, headers={"User-Agent": USER_AGENT})
        res.raise_for_status()
        rows = res.json()
    except (httpx.HTTPError, ValueError) as e:
        log.warning("[airgradient] fetch failed: %s", type(e).__name__)
        return []
    if not isinstance(rows, list):
        log.warning("[airgradient] unexpected payload: %s", type(rows).__name__)
        return []
    now = as_utc(now)
    out = []
    for r in rows:
        try:
            reading = _reading(r, now)
        except (KeyError, TypeError, ValueError, AttributeError):
            continue
        if reading is not None:
            out.append(reading)
    return out
