from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    environment: str = "local"
    database_url: str = "postgresql+asyncpg://avito:avito@localhost:5432/avito"
    redis_url: str = "redis://localhost:6379/0"
    openai_api_key: str | None = None
    openai_model: str = "gpt-4.1-mini"
    crawl_timeout_seconds: float = Field(default=20, gt=0, le=60)
    max_catalog_items: int = Field(default=12, gt=0, le=500)


@lru_cache
def get_settings() -> Settings:
    return Settings()
