"""Toponym renames of the 12 heat cells that carried former district names (spec §A.1).

The static layers (spec §A.2–§A.4) are NOT copied into the DB: runtime reads the committed
climate/spatial/derived.json through climate.spatial.catalogue, one source of truth.

Revision ID: 002
Revises: 001
Create Date: 2026-09-24
"""

import sqlalchemy as sa
from alembic import op

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
RENAME = sa.text("UPDATE spatial_units SET name = :name WHERE id = :id")


def upgrade() -> None:
    op.get_bind().execute(RENAME, [{"id": i, "name": new} for i, (_, new) in RENAMES.items()])


def downgrade() -> None:
    op.get_bind().execute(RENAME, [{"id": i, "name": old} for i, (old, _) in RENAMES.items()])
