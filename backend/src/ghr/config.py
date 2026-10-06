"""Application settings, loaded from environment variables (prefix ``GHR_``) or a ``.env`` file."""

from functools import lru_cache
from pathlib import Path
from typing import Self
from urllib.parse import urlsplit, urlunsplit

from pydantic import Field, SecretStr, field_validator, model_validator
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
    github_api_url: str = Field(
        default="https://api.github.com", description="Overridden by the tests' mock server."
    )

    database_path: Path = Path("data/ghr.db")

    username: str
    password_hash: SecretStr = Field(description="Argon2 hash created with `ghr hash-password`.")
    session_secret: SecretStr = Field(min_length=32)
    session_max_age_days: int = 30
    secure_cookies: bool = Field(
        default=True,
        description="Send the session cookie only over HTTPS. Disable for local development.",
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

    poll_interval_seconds: int = Field(
        default=60,
        ge=60,
        description="Minimum delay between notification polls. GitHub may request a longer one.",
    )
    release_refresh_interval_seconds: int = Field(
        default=1800,
        ge=300,
        description="How often recent releases are re-checked for edited notes or promotions.",
    )
    release_refresh_days: int = Field(
        default=14, ge=1, description="Releases published within this many days are re-checked."
    )
    readme_cache_seconds: int = 3600

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

    @field_validator(
        "public_url",
        "vapid_public_key",
        "vapid_private_key",
        "ntfy_url",
        "ntfy_token",
        "telegram_bot_token",
        "telegram_chat_id",
        "anthropic_api_key",
        mode="before",
    )
    @classmethod
    def _empty_is_unset(cls, value: object) -> object:
        """``GHR_NTFY_URL=`` in the environment file means "not configured"."""
        return None if value == "" else value

    @field_validator("ntfy_url")
    @classmethod
    def _ntfy_url_has_topic(cls, value: str | None) -> str | None:
        if value is not None:
            parts = urlsplit(value)
            if parts.scheme not in ("http", "https") or not parts.path.strip("/"):
                raise ValueError("must be a topic URL such as https://ntfy.sh/your-topic")
        return value

    @model_validator(mode="after")
    def _vapid_keys_come_in_pairs(self) -> Self:
        if (self.vapid_public_key is None) != (self.vapid_private_key is None):
            raise ValueError("Set both GHR_VAPID_PUBLIC_KEY and GHR_VAPID_PRIVATE_KEY, or neither")
        return self

    @property
    def ntfy_target(self) -> tuple[str, str] | None:
        """``https://ntfy.sh/releases`` → (``https://ntfy.sh/``, ``releases``)."""
        if self.ntfy_url is None:
            return None
        parts = urlsplit(self.ntfy_url)
        path, _, topic = parts.path.rstrip("/").rpartition("/")
        return urlunsplit((parts.scheme, parts.netloc, f"{path}/", "", "")), topic

    @property
    def database_url(self) -> str:
        return f"sqlite+aiosqlite:///{self.database_path.as_posix()}"

    @property
    def sync_database_url(self) -> str:
        return f"sqlite:///{self.database_path.as_posix()}"


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]  # populated from the environment
