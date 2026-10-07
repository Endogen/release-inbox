import {
  AlarmClockIcon,
  AlarmClockOffIcon,
  ArrowLeftIcon,
  BellIcon,
  BellOffIcon,
  CheckIcon,
  EyeOffIcon,
  InboxIcon,
  LockIcon,
} from "lucide-react"
import { useEffect, useRef, type ReactNode } from "react"

import { RelativeTime } from "@/components/relative-time"
import { RepoAvatar, UserAvatar } from "@/components/avatars"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Kbd } from "@/components/ui/kbd"
import { Spinner } from "@/components/ui/spinner"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useMediaQuery } from "@/hooks/use-media-query"
import { useNow } from "@/hooks/use-now"
import type { Release } from "@/lib/api/types"
import { formatAbsolute } from "@/lib/time"

import { releaseTitle } from "../release-title"
import { HOTKEYS, keyLabel } from "../shortcuts"
import { canSnooze, viewOf } from "../release-view"
import { BreakingBadge, PrereleaseBadge } from "./release-badges"
import { ReleaseContent, type ContentTab } from "./release-content"
import { ReleaseMoreMenu } from "./release-more-menu"
import { ReleaseVersionSelect } from "./release-version-select"
import { SnoozeMenu } from "./snooze-menu"

interface ReleaseDetailActions {
  onToggleNotifications: () => void
  onMarkRead: () => void
  onMarkUnread: () => void
  onHide: () => void
  onUnsubscribe: () => void
  onSnooze: (until: Date) => void
  onUnsnooze: () => void
  onCopyLink: () => void
}

/** Actions waiting for their undo window to pass. */
interface PendingActions {
  markRead: boolean
  unsubscribe: boolean
}

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
  actions: ReleaseDetailActions
  pending: PendingActions
  snoozeMenuOpen: boolean
  onSnoozeMenuOpenChange: (open: boolean) => void
  onBack?: () => void
  /** Move focus to the title when the release opens (full-screen detail on mobile). */
  focusOnOpen?: boolean
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
}: ReleaseDetailProps) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    if (focusOnOpen) headingRef.current?.focus()
  }, [focusOnOpen, release.repository.id])

  const { repository } = release
  const title = releaseTitle(release)
  const now = useNow()
  // The row stays one line: on narrow phones, secondary actions show only their icon.
  const labels = {
    unsubscribe: useMediaQuery("(min-width: 25.5rem)"),
    snooze: useMediaQuery("(min-width: 20.5rem)"),
  }
  const view = viewOf(release, now)

  return (
    <article className="flex h-full min-h-0 flex-col animate-in duration-300 fade-in slide-in-from-bottom-1">
      <header className="flex flex-col gap-5 border-b px-6 pt-5 pb-5">
        <div className="flex items-center gap-3">
          {onBack && (
            <Button variant="ghost" size="icon-sm" aria-label="Back to list" onClick={onBack}>
              <ArrowLeftIcon />
            </Button>
          )}
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
                <LockIcon
                  aria-label="Private"
                  className="size-3.5 shrink-0 text-muted-foreground"
                />
              )}
            </a>
            {repository.description && (
              <p className="truncate text-xs text-muted-foreground" title={repository.description}>
                {repository.description}
              </p>
            )}
          </div>
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
            {title}
          </h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground">
            <ReleaseVersionSelect release={release} onSelect={onSelectRelease} />
            {release.breaking && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <BreakingBadge />
                </TooltipTrigger>
                <TooltipContent>
                  The notes mention breaking changes, or this is a new major version
                </TooltipContent>
              </Tooltip>
            )}
            {release.prerelease && <PrereleaseBadge />}
            {view === "snoozed" && release.snoozed_until && (
              <Badge variant="secondary">
                <AlarmClockIcon data-icon="inline-start" />
                Snoozed until {formatAbsolute(release.snoozed_until)}
              </Badge>
            )}
            {release.is_hidden && (
              <Badge variant="secondary">
                <EyeOffIcon data-icon="inline-start" />
                Hidden
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
              Published <RelativeTime date={release.published_at} />
            </span>
          </div>
        </div>

        {/* One row on every screen: the frequent actions, and a menu for the rest. */}
        <div className="flex items-center gap-2">
          {release.read_at === null ? (
            <ActionButton hotkey={HOTKEYS.markRead} label="Mark this and older releases as read">
              <Button size="sm" onClick={actions.onMarkRead} aria-busy={pending.markRead}>
                {pending.markRead ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <CheckIcon data-icon="inline-start" />
                )}
                {pending.markRead ? "Marking as read…" : "Mark as read"}
              </Button>
            </ActionButton>
          ) : (
            <ActionButton hotkey={HOTKEYS.markUnread} label="Move back to the inbox">
              <Button size="sm" variant="secondary" onClick={actions.onMarkUnread}>
                <InboxIcon data-icon="inline-start" />
                Mark as unread
              </Button>
            </ActionButton>
          )}
          {canSnooze(release, now) &&
            (view === "snoozed" ? (
              <ActionButton label="Bring it back to the inbox now">
                <Button size="sm" variant="outline" onClick={actions.onUnsnooze}>
                  <AlarmClockOffIcon data-icon="inline-start" />
                  Unsnooze
                </Button>
              </ActionButton>
            ) : (
              <SnoozeMenu
                open={snoozeMenuOpen}
                onOpenChange={onSnoozeMenuOpenChange}
                onSnooze={actions.onSnooze}
                iconOnly={!labels.snooze}
                renderTrigger={(trigger) => (
                  <ActionButton hotkey={HOTKEYS.snooze} label="Put it aside until later">
                    {trigger}
                  </ActionButton>
                )}
              />
            ))}
          {!repository.unsubscribed_at && (
            <ActionButton label="Stop watching this repository on GitHub">
              <Button
                size={labels.unsubscribe ? "sm" : "icon-sm"}
                variant="outline"
                onClick={actions.onUnsubscribe}
                aria-busy={pending.unsubscribe}
                aria-label={labels.unsubscribe ? undefined : "Unsubscribe"}
              >
                {pending.unsubscribe ? (
                  <Spinner data-icon={labels.unsubscribe ? "inline-start" : undefined} />
                ) : (
                  <BellOffIcon data-icon={labels.unsubscribe ? "inline-start" : undefined} />
                )}
                {labels.unsubscribe && (pending.unsubscribe ? "Unsubscribing…" : "Unsubscribe")}
              </Button>
            </ActionButton>
          )}
          <div className="ml-auto">
            <ReleaseMoreMenu
              release={release}
              onCopyLink={actions.onCopyLink}
              onHide={actions.onHide}
            />
          </div>
        </div>
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

function NotificationsToggle({ muted, onToggle }: { muted: boolean; onToggle: () => void }) {
  return (
    <ActionButton
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
    </ActionButton>
  )
}

function ActionButton({
  label,
  hotkey,
  children,
}: {
  label: string
  hotkey?: string
  children: ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent>
        {label}
        {hotkey && <Kbd>{keyLabel(hotkey)}</Kbd>}
      </TooltipContent>
    </Tooltip>
  )
}
