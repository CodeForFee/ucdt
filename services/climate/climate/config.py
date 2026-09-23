from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration, read once from the environment (or services/climate/.env)."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+asyncpg://ucdt:ucdt@localhost:5432/ucdt"
    redis_url: str = "redis://localhost:6379/0"

    # Optional AQI fallbacks — Open-Meteo Air Quality needs no key and is tried first.
    iqair_api_key: str = ""
    aqicn_token: str = ""

    # How often the worker ingests and re-scores, and when a snapshot counts as stale.
    ingest_interval_minutes: int = 15
    stale_after_minutes: int = 45

    # The city the prototype scores. HCMC is the only one with a spatial catalogue.
    city_id: str = "hcmc"
    city_timezone: str = "Asia/Ho_Chi_Minh"


@lru_cache
def get_settings() -> Settings:
    return Settings()
