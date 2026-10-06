"""Request and response models of the HTTP API."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, field_validator


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
    published_at: datetime
    read_at: datetime | None
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
    read: int
    hidden: int


class ReleaseRef(Schema):
    id: int
    tag_name: str
    name: str | None
    published_at: datetime
    read_at: datetime | None
    is_hidden: bool


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
