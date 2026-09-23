"""DB tests run against a separate database, `ucdt_test`, on the server DATABASE_URL points at.
It is created if missing and migrated from base to head once per session. Each test gets a
session whose transaction is rolled back, so tests never see each other's rows."""

import asyncio
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import make_url, text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.pool import NullPool

from climate.config import get_settings

ALEMBIC_INI = Path(__file__).resolve().parents[2] / "alembic.ini"
TEST_URL = make_url(get_settings().database_url).set(database="ucdt_test")


def _alembic_sync(action: str, revision: str) -> None:
    cfg = Config(str(ALEMBIC_INI))
    cfg.attributes["url"] = TEST_URL.render_as_string(hide_password=False)
    cfg.attributes["configure_logger"] = False
    getattr(command, action)(cfg, revision)


async def alembic(action: str, revision: str) -> None:
    # env.py calls asyncio.run(), which cannot nest inside the test loop: use a worker thread.
    await asyncio.to_thread(_alembic_sync, action, revision)


async def _ensure_test_db() -> None:
    admin = create_async_engine(TEST_URL.set(database="postgres"), isolation_level="AUTOCOMMIT")
    async with admin.connect() as conn:
        exists = await conn.scalar(
            text("SELECT 1 FROM pg_database WHERE datname = :n"), {"n": TEST_URL.database}
        )
        if not exists:
            await conn.execute(text(f'CREATE DATABASE "{TEST_URL.database}"'))
    await admin.dispose()


@pytest.fixture(scope="session")
async def engine():
    await _ensure_test_db()
    await alembic("downgrade", "base")  # start from an empty schema whatever a past run left
    await alembic("upgrade", "head")
    # NullPool: the downgrade test drops and recreates tables, so no connection (and no
    # asyncpg prepared-statement cache) may outlive a test.
    eng = create_async_engine(TEST_URL, poolclass=NullPool)
    yield eng
    await eng.dispose()


@pytest.fixture
async def session(engine):
    async with AsyncSession(engine) as s:
        yield s
        await s.rollback()


@pytest.fixture
def run_alembic():
    return alembic
