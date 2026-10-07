import { AlarmClockIcon, ArrowLeftIcon, BellIcon, BellOffIcon, LockIcon } from "lucide-react"
import { useEffect, useRef } from "react"

import { RepoAvatar, UserAvatar } from "@/components/avatars"
import { Hint } from "@/components/hint"
import { Timestamp } from "@/components/timestamp"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { HiddenNotice } from "@/features/hide-rules/hidden-notice"
import { useNow } from "@/hooks/use-now"
import type { HideRuleRef, Release, Repository } from "@/lib/api/types"
import type { ContentTab } from "@/lib/display-settings"
import { HOTKEYS } from "@/lib/hotkeys"
import { formatAbsolute } from "@/lib/time"

import { releaseTitle } from "../release-title"
import { viewOf } from "../release-view"
import { ReleaseActionBar, type PendingActions, type ReleaseActions } from "./release-action-bar"
import { BreakingBadge, PrereleaseBadge } from "./release-badges"
import { ReleaseContent } from "./release-content"
import { ReleaseVersionSelect } from "./release-version-select"
import { StarCount } from "./star-count"

interface ReleaseDetailProps {
  release: Release
  body: string | null | undefined
  /** Unread releases of the entry, shown under "What's new"; 0 hides the tab. */
  whatsNewCount: number
  /** The list's search, which narrows what the entry stands for. */
  search: string
  contentTab: ContentTab
  onContentTabChange: (tab: ContentTab) => void
  onSelectRelease: (releaseId: number) => void
  actions: ReleaseActions & { onToggleNotifications: () => void }
  pending: PendingActions
  snoozeMenuOpen: boolean
  onSnoozeMenuOpenChange: (open: boolean) => void
  onBack?: () => void
  /** Move focus to the title when the release opens (full-screen detail on mobile). */
  focusOnOpen?: boolean
  /** Show the repository's stars; the list shows them where it is next to the detail. */
  showStars?: boolean
  /** The rules that hide the release, once its details have loaded. */
  hideRules: readonly HideRuleRef[] | undefined
  onOpenSettings: () => void
}

export function ReleaseDetail({
  release,
  body,
  whatsNewCount,
  search,
  contentTab,
  onContentTabChange,
  onSelectRelease,
  actions,
  pending,
  snoozeMenuOpen,
  onSnoozeMenuOpenChange,
  onBack,
  focusOnOpen = false,
  showStars = false,
  hideRules,
  onOpenSettings,
}: ReleaseDetailProps) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    if (focusOnOpen) headingRef.current?.focus()
  }, [focusOnOpen, release.repository.id])

  const { repository } = release
  const now = useNow()

  return (
    <article className="flex h-full min-h-0 flex-col animate-in duration-300 fade-in slide-in-from-bottom-1">
      <header className="flex flex-col gap-5 border-b px-6 pt-5 pb-5">
        <div className="flex items-center gap-3">
          {onBack && (
            <Button variant="ghost" size="icon-sm" aria-label="Back to list" onClick={onBack}>
              <ArrowLeftIcon />
            </Button>
          )}
          <RepositoryHeading repository={repository} showStars={showStars} />
          <NotificationsToggle
            muted={repository.notifications_muted_at !== null}
            onToggle={actions.onToggleNotifications}
          />
        </div>

        <div className="flex flex-col gap-2.5">
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="text-2xl font-semibold tracking-tight text-balance break-words outline-none"
          >
            {releaseTitle(release)}
          </h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground">
            <ReleaseVersionSelect release={release} onSelect={onSelectRelease} />
            {release.breaking && (
              <Hint label="The notes mention breaking changes, or this is a new major version">
                <BreakingBadge />
              </Hint>
            )}
            {release.prerelease && <PrereleaseBadge />}
            {viewOf(release, now) === "snoozed" && release.snoozed_until && (
              <Badge variant="secondary">
                <AlarmClockIcon data-icon="inline-start" />
                Snoozed until {formatAbsolute(release.snoozed_until)}
              </Badge>
            )}
            {repository.unsubscribed_at && (
              <Badge variant="secondary">
                <BellOffIcon data-icon="inline-start" />
                Unsubscribed
              </Badge>
            )}
            {release.author_login && (
              <span className="flex items-center gap-1.5">
                <UserAvatar
                  login={release.author_login}
                  avatarUrl={release.author_avatar_url}
                  className="size-5"
                />
                {release.author_login}
              </span>
            )}
            <span>
              Published <Timestamp date={release.published_at} />
            </span>
          </div>
        </div>

        {release.is_hidden && hideRules && (
          <HiddenNotice
            repositoryId={repository.id}
            rules={hideRules}
            onOpenSettings={onOpenSettings}
          />
        )}

        <ReleaseActionBar
          release={release}
          actions={actions}
          pending={pending}
          snoozeMenuOpen={snoozeMenuOpen}
          onSnoozeMenuOpenChange={onSnoozeMenuOpenChange}
        />
      </header>

      <ReleaseContent
        release={release}
        body={body}
        whatsNewCount={whatsNewCount}
        search={search}
        tab={contentTab}
        onTabChange={onContentTabChange}
      />
    </article>
  )
}

function RepositoryHeading({
  repository,
  showStars,
}: {
  repository: Repository
  showStars: boolean
}) {
  const stars = showStars ? repository.stargazers_count : null
  return (
    <>
      <RepoAvatar repository={repository} className="size-10" />
      <div className="flex min-w-0 flex-1 flex-col">
        <a
          href={repository.html_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-sm font-medium hover:underline"
        >
          <span className="truncate">{repository.full_name}</span>
          {repository.private && (
            <LockIcon aria-label="Private" className="size-3.5 shrink-0 text-muted-foreground" />
          )}
        </a>
        {(repository.description || stars !== null) && (
          <p
            className="truncate text-xs text-muted-foreground"
            title={repository.description ?? undefined}
          >
            {stars !== null && <StarCount count={stars} />}
            {stars !== null && repository.description && " · "}
            {repository.description}
          </p>
        )}
      </div>
    </>
  )
}

function NotificationsToggle({ muted, onToggle }: { muted: boolean; onToggle: () => void }) {
  return (
    <Hint
      hotkey={HOTKEYS.notifications}
      label={
        muted
          ? "Notifications are off for this repository. Turn them on"
          : "Notifications are on for this repository. Turn them off"
      }
    >
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Notifications for this repository"
        aria-pressed={!muted}
        onClick={onToggle}
      >
        {muted ? <BellOffIcon /> : <BellIcon />}
      </Button>
    </Hint>
  )
}
