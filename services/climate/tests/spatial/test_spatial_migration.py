"""Migration 002 (spec §A.1 renames) upgrades and downgrades cleanly. Own database,
`ucdt_test_spatial` (pattern of tests/db/conftest.py), so it never races tests/db's downgrades."""

import asyncio
from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import make_url, text
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.pool import NullPool

from climate.config import get_settings
from climate.spatial.units import ALL_UNITS

ALEMBIC_INI = Path(__file__).resolve().parents[2] / "alembic.ini"
TEST_URL = make_url(get_settings().database_url).set(database="ucdt_test_spatial")
CURRENT = {u["id"]: u["name"] for u in ALL_UNITS}
LEGACY = {  # the 12 heat-cell names before 002 (spec §A.1 table)
    "binhthanh": "Bình Thạnh",
    "phunhuan": "Phú Nhuận",
    "tanbinh": "Tân Bình",
    "tanphu": "Tân Phú",
    "govap": "Gò Vấp",
    "binhtan": "Bình Tân",
    "thuduc": "Thủ Đức",
    "binhchanh": "Bình Chánh",
    "hocmon": "Hóc Môn",
    "nhabe": "Nhà Bè",
    "cangio": "Cần Giờ",
    "cuchi": "Củ Chi",
}


def _alembic(action: str, revision: str) -> None:
    cfg = Config(str(ALEMBIC_INI))
    cfg.attributes["url"] = TEST_URL.render_as_string(hide_password=False)
    cfg.attributes["configure_logger"] = False
    getattr(command, action)(cfg, revision)


async def _names(engine) -> dict[str, str]:
    async with engine.connect() as conn:
        return dict((await conn.execute(text("SELECT id, name FROM spatial_units"))).all())


async def test_002_upgrade_downgrade_roundtrip():
    admin = create_async_engine(TEST_URL.set(database="postgres"), isolation_level="AUTOCOMMIT")
    async with admin.connect() as conn:
        if not await conn.scalar(
            text("SELECT 1 FROM pg_database WHERE datname = :n"), {"n": TEST_URL.database}
        ):
            await conn.execute(text(f'CREATE DATABASE "{TEST_URL.database}"'))
    await admin.dispose()
    engine = create_async_engine(TEST_URL, poolclass=NullPool)
    try:
        # env.py calls asyncio.run(), which cannot nest inside the test loop: use a worker thread.
        await asyncio.to_thread(_alembic, "downgrade", "base")
        await asyncio.to_thread(_alembic, "upgrade", "head")
        assert await _names(engine) == CURRENT

        await asyncio.to_thread(_alembic, "downgrade", "001")
        assert await _names(engine) == CURRENT | LEGACY

        await asyncio.to_thread(_alembic, "upgrade", "head")
        assert await _names(engine) == CURRENT
    finally:
        await engine.dispose()
