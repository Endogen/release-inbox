"""Validation of the deployment configuration."""

from pathlib import Path

import pytest
from pydantic import ValidationError

from tests.conftest import make_settings


def test_empty_values_mean_not_configured(tmp_path: Path) -> None:
    settings = make_settings(tmp_path, ntfy_url="", telegram_bot_token="", anthropic_api_key="")

    assert settings.ntfy_url is None
    assert settings.telegram_bot_token is None
    assert settings.anthropic_api_key is None


def test_ntfy_url_is_split_into_server_and_topic(tmp_path: Path) -> None:
    settings = make_settings(tmp_path, ntfy_url="https://ntfy.example/base/releases/")

    assert settings.ntfy_target == ("https://ntfy.example/base/", "releases")


@pytest.mark.parametrize("url", ["https://ntfy.sh", "https://ntfy.sh/", "ftp://ntfy.sh/topic"])
def test_rejects_ntfy_urls_without_topic(tmp_path: Path, url: str) -> None:
    with pytest.raises(ValidationError, match="topic URL"):
        make_settings(tmp_path, ntfy_url=url)


def test_vapid_keys_come_in_pairs(tmp_path: Path) -> None:
    with pytest.raises(ValidationError, match="both"):
        make_settings(tmp_path, vapid_private_key="private")

    settings = make_settings(tmp_path, vapid_public_key="public", vapid_private_key="private")

    assert settings.vapid_public_key == "public"
