"""Add unit_id/unit_name/value to alerts so the FE can localize title/message client-side
(type+severity+value+unitName) instead of showing rules.py's Vietnamese-only text in English
mode (B-017-adjacent, found live 2026-09-25). Nullable: rows written before this stay
Vietnamese-only, which is a graceful degradation, not a bug.

Revision ID: 003
Revises: 002
Create Date: 2026-09-25
"""

import sqlalchemy as sa
from alembic import op

revision = "003"
down_revision = "002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("alerts", sa.Column("unit_id", sa.Text))
    op.add_column("alerts", sa.Column("unit_name", sa.Text))
    op.add_column("alerts", sa.Column("value", sa.Float))


def downgrade() -> None:
    op.drop_column("alerts", "value")
    op.drop_column("alerts", "unit_name")
    op.drop_column("alerts", "unit_id")
