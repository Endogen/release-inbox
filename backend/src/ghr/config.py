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
    release_refresh_interval_seconds: int = Field(
        default=1800,
        ge=300,
        description="How often recent releases are re-checked for edited notes or promotions.",
    )
    release_refresh_days: int = Field(
        default=14, ge=1, description="Releases published within this many days are re-checked."
    )

    login_max_failures: int = Field(
        default=10, ge=1, description="Failed sign-ins per client address before it is blocked."
    )
    login_window_seconds: int = Field(default=900, ge=60)

    enable_api_docs: bool = Field(
        default=False, description="Serve the interactive API docs at /api/docs."
    )
    public_url: str | None = Field(
        default=None,
        description="Address the app is reachable at, e.g. https://releases.example.com. "
        "Used for links in ntfy and Telegram notifications.",
    )

    vapid_public_key: str | None = None
    vapid_private_key: SecretStr | None = None
    vapid_subject: str = "mailto:admin@localhost"

    ntfy_url: str | None = Field(
        default=None, description="ntfy topic URL, e.g. https://ntfy.sh/my-secret-topic."
    )
    ntfy_token: SecretStr | None = None
    telegram_bot_token: SecretStr | None = None
    telegram_chat_id: str | None = None

    anthropic_api_key: SecretStr | None = Field(
        default=None, description="Enables AI summaries of release notes."
    )
    anthropic_model: str = "claude-opus-5-5"

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
