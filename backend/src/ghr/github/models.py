"""Typed subsets of the GitHub REST API payloads used by the application."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class _GitHubModel(BaseModel):
    model_config = ConfigDict(extra="ignore", frozen=True)


class GitHubUser(_GitHubModel):
    login: str
    avatar_url: str


class GitHubRepository(_GitHubModel):
    id: int
    full_name: str
    owner: GitHubUser
    html_url: str
    description: str | None = None
    private: bool = False


class GitHubRepositoryStats(_GitHubModel):
    """The part of a full repository the app uses beyond what notifications include."""

    stargazers_count: int


class NotificationSubject(_GitHubModel):
    title: str
    url: str | None = None
    type: str


class NotificationThread(_GitHubModel):
    id: str
    repository: GitHubRepository
    subject: NotificationSubject
    unread: bool
    updated_at: datetime
    last_read_at: datetime | None = None

    @property
    def is_release(self) -> bool:
        return self.subject.type == "Release" and self.subject.url is not None


class GitHubAsset(_GitHubModel):
    id: int
    name: str
    size: int
    download_count: int = 0
    browser_download_url: str
    content_type: str | None = None
    #: "uploaded", or "open" while an upload is still in progress.
    state: str = "uploaded"


class GitHubRelease(_GitHubModel):
    id: int
    tag_name: str
    name: str | None = None
    body: str | None = None
    html_url: str
    author: GitHubUser | None = None
    prerelease: bool = False
    draft: bool = False
    created_at: datetime
    published_at: datetime | None = None
    assets: list[GitHubAsset] = []


class GitHubReadme(_GitHubModel):
    content: str
    html_url: str
    download_url: str
