"""Worker tests COMMIT (publish-after-commit is the thing under test), so they use their own
database, `ucdt_test_worker`, migrated to head once and truncated before each test. Pattern
copied from tests/db/conftest.py; a separate DB keeps them clear of that suite's downgrades."""

import asyncio
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import make_url, text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from climate.config import get_settings

ALEMBIC_INI = Path(__file__).resolve().parents[2] / "alembic.ini"
TEST_URL = make_url(get_settings().database_url).set(database="ucdt_test_worker")


def _upgrade() -> None:
    cfg = Config(str(ALEMBIC_INI))
    cfg.attributes["url"] = TEST_URL.render_as_string(hide_password=False)
    cfg.attributes["configure_logger"] = False
    command.upgrade(cfg, "head")


@pytest.fixture(scope="session")
async def worker_engine():
    admin = create_async_engine(TEST_URL.set(database="postgres"), isolation_level="AUTOCOMMIT")
    async with admin.connect() as conn:
        if not await conn.scalar(
            text("SELECT 1 FROM pg_database WHERE datname = :n"), {"n": TEST_URL.database}
        ):
            await conn.execute(text(f'CREATE DATABASE "{TEST_URL.database}"'))
    await admin.dispose()
    await asyncio.to_thread(_upgrade)  # env.py calls asyncio.run(): keep it off the test loop
    eng = create_async_engine(TEST_URL)  # pooled: no downgrades here, and connects are slow on Windows
    yield eng
    await eng.dispose()


@pytest.fixture
async def sessionmaker(worker_engine):
    async with worker_engine.begin() as conn:
        await conn.execute(text("TRUNCATE alerts, risk_snapshots, weather_obs, aqi_obs"))
    return async_sessionmaker(worker_engine, expire_on_commit=False)
