from sqlalchemy import text

TABLES = {"spatial_units", "weather_obs", "aqi_obs", "risk_snapshots", "alerts"}


async def _tables(engine) -> set[str]:
    async with engine.connect() as conn:
        rows = await conn.scalars(text("SELECT tablename FROM pg_tables WHERE schemaname = 'public'"))
        return set(rows) & TABLES


async def test_downgrade_base_then_upgrade_head(engine, run_alembic):
    assert await _tables(engine) == TABLES
    await run_alembic("downgrade", "base")
    assert await _tables(engine) == set()
    await run_alembic("upgrade", "head")  # leave the schema as the other tests expect it
    assert await _tables(engine) == TABLES
    async with engine.connect() as conn:
        assert await conn.scalar(text("SELECT count(*) FROM spatial_units")) == 63
