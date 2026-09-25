"""SQLAlchemy Core tables mirroring migration 001. The migrations own the schema; these
only give the repository typed columns (no ORM, no autogenerate)."""

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

TS = sa.TIMESTAMP(timezone=True)
metadata = sa.MetaData()


class Geography(sa.types.UserDefinedType):
    """PostGIS geography(Point,4326) without geoalchemy2. Read it through ST_X/ST_Y."""

    cache_ok = True

    def get_col_spec(self, **kw) -> str:
        return "geography(Point,4326)"


spatial_units = sa.Table(
    "spatial_units",
    metadata,
    sa.Column("id", sa.Text, primary_key=True),
    sa.Column("kind", sa.Text, nullable=False),
    sa.Column("name", sa.Text, nullable=False),
    sa.Column("geom", Geography(), nullable=False),
    sa.Column("props", JSONB, nullable=False),
)

weather_obs = sa.Table(
    "weather_obs",
    metadata,
    sa.Column("id", sa.BigInteger, primary_key=True),
    sa.Column("location_id", sa.Text, nullable=False),
    sa.Column("fetched_at", TS, nullable=False),
    sa.Column("payload", JSONB, nullable=False),
)

aqi_obs = sa.Table(
    "aqi_obs",
    metadata,
    sa.Column("id", sa.BigInteger, primary_key=True),
    sa.Column("location_id", sa.Text, nullable=False),
    sa.Column("fetched_at", TS, nullable=False),
    sa.Column("aqi", sa.Integer),
    sa.Column("pm25", sa.Double),
    sa.Column("pm10", sa.Double),
    sa.Column("o3", sa.Double),
    sa.Column("no2", sa.Double),
    sa.Column("source", sa.Text),
)

risk_snapshots = sa.Table(
    "risk_snapshots",
    metadata,
    sa.Column("id", sa.BigInteger, primary_key=True),
    sa.Column("hazard", sa.Text, nullable=False),
    sa.Column("computed_at", TS, nullable=False),
    sa.Column("model_version", sa.Text, nullable=False),
    sa.Column("inputs", JSONB, nullable=False),
    sa.Column("result", JSONB, nullable=False),
)

alerts = sa.Table(
    "alerts",
    metadata,
    sa.Column("id", sa.Text, primary_key=True),
    sa.Column("rule_id", sa.Text, nullable=False),
    sa.Column("type", sa.Text, nullable=False),
    sa.Column("severity", sa.Text, nullable=False),
    sa.Column("title", sa.Text, nullable=False),
    sa.Column("message", sa.Text, nullable=False),
    # unit_id/unit_name/value: nullable, added after the initial schema (migration 003) so the
    # FE can localize title/message client-side (type+severity+value+unitName) instead of
    # showing this Vietnamese-only text in English mode. NULL on rows written before that.
    sa.Column("unit_id", sa.Text),
    sa.Column("unit_name", sa.Text),
    sa.Column("value", sa.Float),
    sa.Column("snapshot_id", sa.BigInteger, sa.ForeignKey("risk_snapshots.id", ondelete="SET NULL")),
    sa.Column("created_at", TS, nullable=False),
    sa.Column("expires_at", TS, nullable=False),
    sa.Column("read_at", TS),
)
