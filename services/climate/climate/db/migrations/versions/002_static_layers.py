"""Toponym renames (spec §A.1) + static layers (spec §A.2–§A.3) merged into spatial_units.props.

Revision ID: 002
Revises: 001
Create Date: 2026-09-24
"""

import json

import sqlalchemy as sa
from alembic import op

from climate.spatial.catalogue import DERIVED_PATH

revision = "002"
down_revision = "001"
branch_labels = None
depends_on = None

# Frozen here (not read from units.py) so this revision means the same thing forever.
RENAMES = {  # id: (legacy name, toponym)
    "binhthanh": ("Bình Thạnh", "Đinh Bộ Lĩnh"),
    "phunhuan": ("Phú Nhuận", "Phan Xích Long"),
    "tanbinh": ("Tân Bình", "Lê Văn Sỹ"),
    "tanphu": ("Tân Phú", "Lũy Bán Bích"),
    "govap": ("Gò Vấp", "Nguyễn Oanh"),
    "binhtan": ("Bình Tân", "An Lạc"),
    "thuduc": ("Thủ Đức", "Linh Trung"),
    "binhchanh": ("Bình Chánh", "Nguyễn Văn Linh"),
    "hocmon": ("Hóc Môn", "Quang Trung"),
    "nhabe": ("Nhà Bè", "Phước Kiển"),
    "cangio": ("Cần Giờ", "Cần Thạnh"),
    "cuchi": ("Củ Chi", "Tây Bắc"),
}
# The derived.json keys this revision adds to props; downgrade removes exactly these.
KEYS = ["builtUp", "commune", "commune_osm_id", "elevation_m", "green", "roadDensity", "slope_pct", "water"]

RENAME = sa.text("UPDATE spatial_units SET name = :name WHERE id = :id")


def upgrade() -> None:
    # ponytail: like 001 reading units.py, this reads the live derived.json, so re-deriving
    # changes what a fresh `upgrade 002` merges. Add a 003 when derived.json is re-derived.
    units = json.loads(DERIVED_PATH.read_text(encoding="utf-8"))["units"]
    conn = op.get_bind()
    conn.execute(RENAME, [{"id": i, "name": new} for i, (_, new) in RENAMES.items()])
    conn.execute(
        sa.text("UPDATE spatial_units SET props = props || CAST(:props AS jsonb) WHERE id = :id"),
        [{"id": i, "props": json.dumps({k: row[k] for k in KEYS if k in row})} for i, row in units.items()],
    )


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(RENAME, [{"id": i, "name": old} for i, (old, _) in RENAMES.items()])
    conn.execute(sa.text("UPDATE spatial_units SET props = props - CAST(:keys AS text[])"), {"keys": KEYS})
