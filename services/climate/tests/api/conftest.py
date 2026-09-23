"""API tests hit a real DB, `ucdt_test_api` (pattern of tests/db/conftest.py; its own name because
tests/db downgrades `ucdt_test` to base, which would break these if suites run concurrently):
migrated once per session, each test's rows rolled back. The app's session dependency is
overridden to yield that test session, so requests see exactly what the test seeded."""

import asyncio
from pathlib import Path

import httpx
import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import make_url, text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.pool import NullPool

from climate.api.main import app, get_session
from climate.config import get_settings

ALEMBIC_INI = Path(__file__).resolve().parents[2] / "alembic.ini"
TEST_URL = make_url(get_settings().database_url).set(database="ucdt_test_api")


def _upgrade_head() -> None:
    cfg = Config(str(ALEMBIC_INI))
    cfg.attributes["url"] = TEST_URL.render_as_string(hide_password=False)
    cfg.attributes["configure_logger"] = False
    command.upgrade(cfg, "head")


@pytest.fixture(scope="session")
async def engine():
    admin = create_async_engine(TEST_URL.set(database="postgres"), isolation_level="AUTOCOMMIT")
    async with admin.connect() as conn:
        if not await conn.scalar(
            text("SELECT 1 FROM pg_database WHERE datname = :n"), {"n": TEST_URL.database}
        ):
            await conn.execute(text(f'CREATE DATABASE "{TEST_URL.database}"'))
    await admin.dispose()
    # env.py calls asyncio.run(), which cannot nest inside the test loop: use a worker thread.
    await asyncio.to_thread(_upgrade_head)
    eng = create_async_engine(TEST_URL, poolclass=NullPool)
    yield eng
    await eng.dispose()


@pytest.fixture
async def session(engine):
    async with AsyncSession(engine) as s:
        yield s
        await s.rollback()


@pytest.fixture
async def client(session):
    async def _session():
        yield session

    app.dependency_overrides[get_session] = _session
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://climate") as c:
        yield c
    app.dependency_overrides.clear()
