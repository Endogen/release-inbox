/** Types mirroring the backend API schemas (backend/src/ghr/schemas.py). */

export type View = "inbox" | "snoozed" | "read" | "hidden"

export const VIEWS: readonly View[] = ["inbox", "snoozed", "read", "hidden"]

export function isView(value: unknown): value is View {
  return VIEWS.includes(value as View)
}

export interface Repository {
  id: number
  full_name: string
  owner_avatar_url: string
  html_url: string
  description: string | null
  private: boolean
  unsubscribed_at: string | null
  /** Set when push notifications for the repository are turned off. */
  notifications_muted_at: string | null
  /** ``null`` until the server has fetched it. */
  stargazers_count: number | null
}

export interface Release {
  id: number
  tag_name: string
  name: string | null
  html_url: string
  author_login: string | null
  author_avatar_url: string | null
  prerelease: boolean
  /** The notes announce breaking changes, or the version is a new major version. */
  breaking: boolean
  published_at: string
  read_at: string | null
  /** Hidden from the inbox until this time. */
  snoozed_until: string | null
  is_hidden: boolean
  repository: Repository
}

export interface ReleaseListItem extends Release {
  older_count: number
}

/** A file attached to a release. */
export interface ReleaseAsset {
  id: number
  name: string
  size: number
  download_count: number
  /** Download link on github.com. */
  url: string
  content_type: string | null
}

export interface ReleaseDetail extends Release {
  body: string | null
}

export interface ReleasePage {
  items: ReleaseListItem[]
  total: number
}

export type ViewCounts = Record<View, number>

export interface ReleaseRef {
  id: number
  tag_name: string
  name: string | null
  published_at: string
  read_at: string | null
  is_hidden: boolean
}

export interface HideRule {
  id: number
  pattern: string
  created_at: string
  repository: Repository
  match_count: number
}

export interface HideRulePreview {
  total: number
  matches: ReleaseRef[]
}

export interface Readme {
  content: string
  html_url: string
  download_url: string
}

export interface SyncStatus {
  last_synced_at: string | null
  last_attempt_at: string | null
  last_error: string | null
  in_progress: boolean
  /** GitHub asked not to be contacted before this time (rate limit). */
  rate_limited_until: string | null
}

export interface CurrentUser {
  username: string
}

/** How pre-releases are treated: normally, in the inbox without notifications, or hidden. */
export type PrereleaseMode = "show" | "mute" | "hide"

export interface Preferences {
  prereleases: PrereleaseMode
}

export interface NotificationChannel {
  name: "web-push" | "ntfy" | "telegram"
  configured: boolean
}

export interface NotificationTestResult {
  delivered: Partial<Record<NotificationChannel["name"], boolean>>
}

export interface SummaryConfig {
  enabled: boolean
  model: string | null
}

export interface Summary {
  content: string
  model: string
}

export interface PushConfig {
  enabled: boolean
  public_key: string | null
}
