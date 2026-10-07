"""Request and response models of the HTTP API."""

import base64
import binascii
from datetime import UTC, datetime
from typing import Annotated, Literal

from pydantic import (
    AfterValidator,
    AwareDatetime,
    BaseModel,
    ConfigDict,
    Field,
    HttpUrl,
    field_validator,
)

from ghr.domain import PrereleaseMode, View


class Schema(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class RepositoryOut(Schema):
    id: int
    full_name: str
    owner_avatar_url: str
    html_url: str
    description: str | None
    private: bool
    unsubscribed_at: datetime | None
    notifications_muted_at: datetime | None
    #: ``None`` until it has been fetched.
    stargazers_count: int | None


class RepositoryNotificationsUpdate(BaseModel):
    enabled: bool


class ReleaseOut(Schema):
    id: int
    tag_name: str
    name: str | None
    html_url: str
    author_login: str | None
    author_avatar_url: str | None
    prerelease: bool
    breaking: bool
    published_at: datetime
    read_at: datetime | None
    snoozed_until: datetime | None
    is_hidden: bool
    repository: RepositoryOut


class ReleaseListItem(ReleaseOut):
    older_count: int = Field(description="Further releases of the repository in the same view.")


class ReleaseDetail(ReleaseOut):
    body: str | None


class ReleasePage(Schema):
    items: list[ReleaseListItem]
    total: int


class ViewCounts(Schema):
    inbox: int
    snoozed: int
    read: int
    hidden: int


class ReleaseRef(Schema):
    id: int
    tag_name: str
    name: str | None
    published_at: datetime
    read_at: datetime | None
    is_hidden: bool


#: Longest accepted search, in characters.
MAX_SEARCH_LENGTH = 200


class MarkReadRequest(BaseModel):
    #: Also mark the older unread releases of the repository in this view (what the user
    #: saw as ``+N older``). ``None`` marks only the release itself.
    include_older_in: View | None = None
    #: The search the entry was listed under; older releases must match it too.
    search: str | None = Field(default=None, max_length=MAX_SEARCH_LENGTH)


class SnoozeRequest(BaseModel):
    until: AwareDatetime
    #: The view the user snoozed from; older releases of the repository in it are snoozed too.
    view: Literal[View.INBOX, View.SNOOZED] = View.INBOX
    #: The search the entry was listed under; older releases must match it too.
    search: str | None = Field(default=None, max_length=MAX_SEARCH_LENGTH)

    @field_validator("until")
    @classmethod
    def _in_future(cls, value: datetime) -> datetime:
        if value <= datetime.now(UTC):
            raise ValueError("The snooze time must be in the future")
        return value


def normalize_pattern(value: str) -> str:
    """Hide-rule patterns ignore surrounding whitespace and can't be blank."""
    stripped = value.strip()
    if not stripped:
        raise ValueError("Pattern must not be blank")
    return stripped


HidePattern = Annotated[str, Field(max_length=255), AfterValidator(normalize_pattern)]


class HideRuleCreate(BaseModel):
    repository_id: int
    pattern: HidePattern


class HideRuleOut(Schema):
    id: int
    pattern: str
    created_at: datetime
    repository: RepositoryOut
    match_count: int


class HideRulePreview(Schema):
    total: int
    matches: list[ReleaseRef]


class ReadmeOut(Schema):
    content: str
    html_url: str
    download_url: str


class SyncStatus(Schema):
    last_synced_at: datetime | None
    last_attempt_at: datetime | None
    last_error: str | None
    in_progress: bool
    #: GitHub asked not to be contacted before this time (rate limit); syncs wait for it.
    rate_limited_until: datetime | None = None


class Credentials(BaseModel):
    username: str = Field(min_length=1, max_length=255)
    password: str = Field(min_length=1, max_length=1024)


class CurrentUser(Schema):
    username: str


class PreferenceSettings(Schema):
    prereleases: PrereleaseMode


class NotificationChannelOut(Schema):
    name: str
    configured: bool


class NotificationTestResult(Schema):
    delivered: dict[str, bool]


class SummaryConfig(Schema):
    enabled: bool
    model: str | None


MAX_SUMMARIZED_RELEASES = 20


class SummaryRequest(BaseModel):
    release_ids: list[int] = Field(min_length=1, max_length=MAX_SUMMARIZED_RELEASES)


class SummaryOut(Schema):
    content: str
    model: str


class PushConfig(Schema):
    enabled: bool
    public_key: str | None


def _decode_base64url(value: str) -> bytes:
    try:
        return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))
    except (binascii.Error, ValueError) as error:
        raise ValueError("Must be base64url-encoded") from error


class PushKeys(BaseModel):
    """The keys of a browser push subscription, base64url-encoded as browsers send them."""

    p256dh: str = Field(max_length=255)
    auth: str = Field(max_length=255)

    @field_validator("p256dh")
    @classmethod
    def _public_key(cls, value: str) -> str:
        key = _decode_base64url(value)
        if len(key) != 65 or key[0] != 0x04:  # noqa: PLR2004 (uncompressed P-256 point)
            raise ValueError("Must be an uncompressed P-256 public key")
        return value

    @field_validator("auth")
    @classmethod
    def _auth_secret(cls, value: str) -> str:
        if len(_decode_base64url(value)) != 16:  # noqa: PLR2004 (RFC 8291 auth secret)
            raise ValueError("Must be a 16-byte authentication secret")
        return value


class PushSubscriptionIn(BaseModel):
    endpoint: HttpUrl
    keys: PushKeys


class PushSubscriptionRef(BaseModel):
    endpoint: HttpUrl
