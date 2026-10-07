import type { Release, ReleaseListItem, Repository } from "@/lib/api/types"

export function makeRepository(overrides: Partial<Repository> = {}): Repository {
  return {
    id: 10,
    full_name: "acme/app",
    owner_avatar_url: "https://avatars.githubusercontent.com/u/1",
    html_url: "https://github.com/acme/app",
    description: null,
    private: false,
    unsubscribed_at: null,
    notifications_muted_at: null,
    stargazers_count: null,
    ...overrides,
  }
}

export function makeRelease(overrides: Partial<Release> = {}): Release {
  return {
    id: 1,
    tag_name: "v1.0.0",
    name: null,
    html_url: "https://github.com/acme/app/releases/tag/v1.0.0",
    author_login: null,
    author_avatar_url: null,
    prerelease: false,
    breaking: false,
    published_at: "2026-10-01T10:00:00Z",
    read_at: null,
    snoozed_until: null,
    is_hidden: false,
    repository: makeRepository(),
    ...overrides,
  }
}

export function makeListItem(overrides: Partial<ReleaseListItem> = {}): ReleaseListItem {
  return { ...makeRelease(overrides), older_count: 0, ...overrides }
}
