"""Spec §A.1 guard over every unit name and every commune string in derived.json.

Commune strings are the official 2025 names exactly as OSM gives them; several legitimately
reuse a former district name ("Phường Bình Thạnh"), so the former-name list applies to unit
names only (lead decision 2026-09-24, spec amendment). Communes are never rendered (§J).
"""

import json
import re

from climate.spatial.catalogue import DERIVED_PATH
from climate.spatial.units import ALL_UNITS

ADMIN = re.compile(r"\b(Quận|Huyện|District)\b|\bQ\.\s?\d")
FORMER_DISTRICTS = (
    "Bình Thạnh, Phú Nhuận, Tân Bình, Tân Phú, Gò Vấp, Bình Tân, Thủ Đức, Bình Chánh, Hóc Môn, Nhà Bè, "
    "Cần Giờ, Củ Chi"
).split(", ")
FORMER = re.compile(r"\b(" + "|".join(FORMER_DISTRICTS) + r")\b")
COMMUNE_PREFIX = ("Phường ", "Xã ", "Đặc khu ")


def violates(name: str) -> bool:
    return bool(ADMIN.search(name) or FORMER.search(name))


def test_guard_catches_admin_labels():
    for bad in ("Quận 1", "Q.8", "Q. 12", "District 7", "Huyện Củ Chi", "Gò Vấp", "Thủ Đức", "Bình Thạnh"):
        assert violates(bad), bad
    for ok in ("Đinh Bộ Lĩnh", "Cần Thạnh", "Bình Hưng", "An Phú", "Bến Nghé"):
        assert not violates(ok), ok


def test_unit_names():
    assert len(ALL_UNITS) == 63
    assert [u["name"] for u in ALL_UNITS if violates(u["name"])] == []


def test_commune_strings():
    units = json.loads(DERIVED_PATH.read_text(encoding="utf-8"))["units"]
    communes = {u["commune"] for u in units.values()}
    assert [c for c in communes if not c.startswith(COMMUNE_PREFIX)] == []
    assert [c for c in communes if ADMIN.search(c)] == []
