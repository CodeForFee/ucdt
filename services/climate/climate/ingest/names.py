"""Spec §A.1 display-name guard, applied to third-party station names at ingest (§I.3).

Matching is case- and diacritic-insensitive (so "quan 1", "Binh Thanh" and "DISTRICT 3" are all
caught). That also flags innocent words that fold to the same letters ("Quán", "Huyền"); the
cost is only a generic station name, the safe direction."""

import re
import unicodedata

FORMER_DISTRICTS = (
    "Bình Thạnh",
    "Phú Nhuận",
    "Tân Bình",
    "Tân Phú",
    "Gò Vấp",
    "Bình Tân",
    "Thủ Đức",
    "Bình Chánh",
    "Hóc Môn",
    "Nhà Bè",
    "Cần Giờ",
    "Củ Chi",
)


def fold(s: str) -> str:
    """Lower-case ASCII-ish form: diacritics stripped, đ -> d."""
    s = unicodedata.normalize("NFD", s).replace("đ", "d").replace("Đ", "D")
    return "".join(ch for ch in s if unicodedata.category(ch) != "Mn").casefold()


# The spec regex /\b(Quận|Huyện|District)\b|\bQ\.\s?\d/, on folded text, plus the former names.
_GUARD = re.compile(
    r"\b(quan|huyen|district)\b|\bq\.\s?\d|\b("
    + "|".join(re.escape(fold(n)).replace(r"\ ", r"\s+") for n in FORMER_DISTRICTS)
    + r")\b"
)


def is_admin_label(name: str) -> bool:
    return bool(_GUARD.search(fold(name)))
