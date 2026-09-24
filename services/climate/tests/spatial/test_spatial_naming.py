"""Spec §A.1 guard over every unit name and every commune string in derived.json.

Unit names: the spec regex verbatim plus the former-district list (the list is reused from
climate.ingest.names; its folded is_admin_label is deliberately NOT used here — it flags the real
toponym "Lạc Long Quân", a cost T-102 accepts only for third-party station names). Communes (#57):
the OFFICIAL 2025 name exactly as OSM gives it, so the former-name list does not apply ("Phường
Bình Thạnh" is legitimate); it must start with "Phường ", "Xã " or "Đặc khu " and must not match
the regex. Communes are data/API-only, never rendered (§A.3, §J).
"""

import json
import re

from climate.ingest.names import FORMER_DISTRICTS
from climate.spatial.catalogue import DERIVED_PATH
from climate.spatial.units import ALL_UNITS

ADMIN = re.compile(r"\b(Quận|Huyện|District)\b|\bQ\.\s?\d")  # spec §A.1, verbatim
FORMER = re.compile(r"\b(" + "|".join(FORMER_DISTRICTS) + r")\b")
COMMUNE_PREFIX = ("Phường ", "Xã ", "Đặc khu ")


def violates(name: str) -> bool:
    return bool(ADMIN.search(name) or FORMER.search(name))


def test_guard_catches_admin_labels():
    for bad in ("Quận 1", "Q.8", "Q. 12", "District 7", "Huyện Củ Chi", "Gò Vấp", "Thủ Đức", "Bình Thạnh"):
        assert violates(bad), bad
    for ok in ("Đinh Bộ Lĩnh", "Cần Thạnh", "Bình Hưng", "Lạc Long Quân", "Quang Trung", "Bến Nghé"):
        assert not violates(ok), ok


def test_unit_names():
    assert len(ALL_UNITS) == 63
    assert [u["name"] for u in ALL_UNITS if violates(u["name"])] == []


def test_commune_strings():
    units = json.loads(DERIVED_PATH.read_text(encoding="utf-8"))["units"]
    communes = sorted({u["commune"] for u in units.values()})
    assert [c for c in communes if not c.startswith(COMMUNE_PREFIX)] == []
    assert [c for c in communes if ADMIN.search(c)] == []
