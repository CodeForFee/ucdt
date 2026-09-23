"""Initial schema: spatial units (seeded), observations, risk snapshots, alerts.

Revision ID: 001
Revises:
Create Date: 2026-09-23
"""

import json

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

from climate.db.models import Geography
from climate.spatial.units import ALL_UNITS

revision = "001"
down_revision = None
branch_labels = None
depends_on = None

TS = sa.TIMESTAMP(timezone=True)


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis")

    op.create_table(
        "spatial_units",
        sa.Column("id", sa.Text, primary_key=True),
        sa.Column("kind", sa.Text, nullable=False),
        sa.Column("name", sa.Text, nullable=False),
        sa.Column("geom", Geography(), nullable=False),
        sa.Column("props", JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.CheckConstraint("kind IN ('flood_zone','heat_cell','aqi_point')", name="ck_spatial_units_kind"),
    )
    # ponytail: seeds from the live catalogue, so editing units.py changes what a fresh
    # `upgrade 001` inserts. Freeze the rows here if units.py ever diverges from 001.
    base = {"id", "kind", "name", "lat", "lng"}
    op.get_bind().execute(
        sa.text(
            "INSERT INTO spatial_units (id, kind, name, geom, props) VALUES "
            "(:id, :kind, :name, CAST(ST_SetSRID(ST_MakePoint(:lng, :lat), 4326) AS geography), "
            "CAST(:props AS jsonb))"
        ),
        [
            {
                "id": u["id"],
                "kind": u["kind"],
                "name": u["name"],
                "lat": u["lat"],
                "lng": u["lng"],
                "props": json.dumps({k: v for k, v in u.items() if k not in base}),
            }
            for u in ALL_UNITS
        ],
    )

    op.create_table(
        "weather_obs",
        sa.Column("id", sa.BigInteger, primary_key=True),
        sa.Column("location_id", sa.Text, nullable=False),
        sa.Column("fetched_at", TS, nullable=False),
        sa.Column("payload", JSONB, nullable=False),
    )
    op.create_index("ix_weather_obs_loc_time", "weather_obs", ["location_id", sa.text("fetched_at DESC")])

    op.create_table(
        "aqi_obs",
        sa.Column("id", sa.BigInteger, primary_key=True),
        sa.Column("location_id", sa.Text, nullable=False),  # a spatial unit id or 'city'
        sa.Column("fetched_at", TS, nullable=False),
        sa.Column("aqi", sa.Integer),
        sa.Column("pm25", sa.Double),
        sa.Column("pm10", sa.Double),
        sa.Column("o3", sa.Double),
        sa.Column("no2", sa.Double),
        sa.Column("source", sa.Text),
    )
    op.create_index("ix_aqi_obs_loc_time", "aqi_obs", ["location_id", sa.text("fetched_at DESC")])

    op.create_table(
        "risk_snapshots",
        sa.Column("id", sa.BigInteger, primary_key=True),
        sa.Column("hazard", sa.Text, nullable=False),
        sa.Column("computed_at", TS, nullable=False),
        sa.Column("model_version", sa.Text, nullable=False),
        sa.Column("inputs", JSONB, nullable=False),
        sa.Column("result", JSONB, nullable=False),
        sa.CheckConstraint(
            "hazard IN ('weather','flood','heat','aqi','recommend')", name="ck_risk_snapshots_hazard"
        ),
    )
    op.create_index(
        "ix_risk_snapshots_hazard_time", "risk_snapshots", ["hazard", sa.text("computed_at DESC")]
    )

    op.create_table(
        "alerts",
        sa.Column("id", sa.Text, primary_key=True),
        sa.Column("rule_id", sa.Text, nullable=False),
        sa.Column("type", sa.Text, nullable=False),
        sa.Column("severity", sa.Text, nullable=False),
        sa.Column("title", sa.Text, nullable=False),
        sa.Column("message", sa.Text, nullable=False),
        sa.Column(
            "snapshot_id",
            sa.BigInteger,
            sa.ForeignKey("risk_snapshots.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("created_at", TS, nullable=False),
        sa.Column("expires_at", TS, nullable=False),
        sa.Column("read_at", TS, nullable=True),
    )
    op.create_index("ix_alerts_expires_at", "alerts", ["expires_at"])


def downgrade() -> None:
    # The postgis extension is left in place: the postgis image pre-installs it (with
    # postgis_topology depending on it) in POSTGRES_DB, so dropping it would fail there.
    for table in ("alerts", "risk_snapshots", "aqi_obs", "weather_obs", "spatial_units"):
        op.drop_table(table)
