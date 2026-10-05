"""Application settings, loaded from environment variables (prefix ``GHR_``) or a ``.env`` file."""

from functools import lru_cache
from pathlib import Path

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="GHR_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    github_token: SecretStr = Field(
        description="Classic personal access token with the 'notifications' and 'repo' scopes.",
    )
    github_api_url: str = "https://api.github.com"

    database_path: Path = Path("data/ghr.db")

    username: str
    password_hash: SecretStr = Field(description="Argon2 hash created with `ghr hash-password`.")
    session_secret: SecretStr = Field(min_length=32)
    session_max_age_days: int = 30
    secure_cookies: bool = Field(
        default=True,
        description="Send the session cookie only over HTTPS. Disable for local development.",
    )

    poll_interval_seconds: int = Field(
        default=60,
        ge=60,
        description="Minimum delay between notification polls. GitHub may request a longer one.",
    )
    readme_cache_seconds: int = 3600

    vapid_public_key: str | None = None
    vapid_private_key: SecretStr | None = None
    vapid_subject: str = "mailto:admin@localhost"

    @property
    def database_url(self) -> str:
        return f"sqlite+aiosqlite:///{self.database_path.as_posix()}"

    @property
    def sync_database_url(self) -> str:
        return f"sqlite:///{self.database_path.as_posix()}"

    @property
    def push_enabled(self) -> bool:
        return bool(self.vapid_public_key and self.vapid_private_key)


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]  # populated from the environment
