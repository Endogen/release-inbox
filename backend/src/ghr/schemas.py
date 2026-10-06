"""Request and response models of the HTTP API."""

from datetime import UTC, datetime

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, HttpUrl, field_validator


class Schema(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class RepositoryOut(Schema):
    id: int
    full_name: str
    owner_login: str
    owner_avatar_url: str
    html_url: str
    description: str | None
    private: bool
    unsubscribed_at: datetime | None
    notifications_muted_at: datetime | None


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


class SnoozeRequest(BaseModel):
    until: AwareDatetime

    @field_validator("until")
    @classmethod
    def _in_future(cls, value: datetime) -> datetime:
        if value <= datetime.now(UTC):
            raise ValueError("The snooze time must be in the future")
        return value


class HideRuleCreate(BaseModel):
    repository_id: int
    pattern: str = Field(min_length=1, max_length=255)

    @field_validator("pattern")
    @classmethod
    def _strip(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("Pattern must not be blank")
        return stripped


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


class Credentials(BaseModel):
    username: str = Field(min_length=1, max_length=255)
    password: str = Field(min_length=1, max_length=1024)


class CurrentUser(Schema):
    username: str


class PreferencesOut(Schema):
    show_prereleases: bool
    notify_prereleases: bool


class PreferencesUpdate(BaseModel):
    show_prereleases: bool | None = None
    notify_prereleases: bool | None = None


class NotificationChannelOut(Schema):
    name: str
    configured: bool


class NotificationTestResult(Schema):
    delivered: dict[str, bool]


class SummaryConfig(Schema):
    enabled: bool
    model: str | None


class SummaryRequest(BaseModel):
    release_ids: list[int] = Field(min_length=1, max_length=20)


class SummaryOut(Schema):
    content: str
    model: str


class PushConfig(Schema):
    enabled: bool
    public_key: str | None


class PushKeys(BaseModel):
    p256dh: str = Field(min_length=1, max_length=255)
    auth: str = Field(min_length=1, max_length=255)


class PushSubscriptionIn(BaseModel):
    endpoint: HttpUrl
    keys: PushKeys


class PushSubscriptionRef(BaseModel):
    endpoint: HttpUrl
