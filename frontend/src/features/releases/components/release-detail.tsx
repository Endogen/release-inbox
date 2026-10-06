import {
  AlarmClockIcon,
  AlarmClockOffIcon,
  ArrowLeftIcon,
  BellIcon,
  BellOffIcon,
  BookMarkedIcon,
  CheckIcon,
  EyeOffIcon,
  InboxIcon,
  LockIcon,
  TagIcon,
  ZapIcon,
} from "lucide-react"
import { useEffect, useRef, type ReactNode } from "react"

import { RelativeTime } from "@/components/relative-time"
import { RepoAvatar, UserAvatar } from "@/components/repo-avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Kbd } from "@/components/ui/kbd"
import { Spinner } from "@/components/ui/spinner"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useNow } from "@/hooks/use-now"
import type { Release } from "@/lib/api/types"
import { formatAbsolute } from "@/lib/time"
import { cn } from "@/lib/utils"

import { releaseTitle } from "../release-title"
import { ReleaseContent, type ContentTab } from "./release-content"
import { ReleaseVersionSelect } from "./release-version-select"
import { SnoozeMenu } from "./snooze-menu"

export interface ReleaseDetailActions {
  onToggleNotifications: () => void
  onMarkRead: () => void
  onMarkUnread: () => void
  onHide: () => void
  onUnsubscribe: () => void
  onSnooze: (until: Date) => void
  onUnsnooze: () => void
}

/** Actions waiting for their undo window to pass. */
export interface PendingActions {
  markRead: boolean
  unsubscribe: boolean
}

interface ReleaseDetailProps {
  release: Release
  body: string | null | undefined
  /** Unread inbox releases of the repository (drives "What's new"). */
  unreadCount: number
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
  unreadCount,
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
  const snoozed =
    release.snoozed_until !== null && new Date(release.snoozed_until).getTime() > now

  return (
    <article
      key={release.repository.id}
      className="flex h-full min-h-0 flex-col animate-in duration-300 fade-in slide-in-from-bottom-1"
    >
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
              className="flex items-center gap-1.5 truncate text-sm font-medium hover:underline"
            >
              {repository.full_name}
              {repository.private && <LockIcon className="size-3.5 text-muted-foreground" />}
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
          <ReleaseVersionSelect
            repositoryId={repository.id}
            releaseId={release.id}
            onSelect={onSelectRelease}
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
            <Badge variant="outline" className="font-mono">
              <TagIcon data-icon="inline-start" />
              {release.tag_name}
            </Badge>
            {release.breaking && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="destructive">
                    <ZapIcon data-icon="inline-start" />
                    Breaking
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  The notes mention breaking changes, or this is a new major version
                </TooltipContent>
              </Tooltip>
            )}
            {release.prerelease && <Badge variant="secondary">Pre-release</Badge>}
            {snoozed && release.snoozed_until && (
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

        <div className="flex flex-wrap items-center gap-2">
          {release.read_at === null ? (
            <ActionButton hotkey="e" label="Mark this and older releases as read">
              <Button size="sm" onClick={actions.onMarkRead} disabled={pending.markRead}>
                {pending.markRead ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <CheckIcon data-icon="inline-start" />
                )}
                {pending.markRead ? "Marking as read…" : "Mark as read"}
              </Button>
            </ActionButton>
          ) : (
            <ActionButton hotkey="u" label="Move back to the inbox">
              <Button size="sm" variant="secondary" onClick={actions.onMarkUnread}>
                <InboxIcon data-icon="inline-start" />
                Mark as unread
              </Button>
            </ActionButton>
          )}
          {release.read_at === null &&
            (snoozed ? (
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
                renderTrigger={(trigger) => (
                  <ActionButton hotkey="s" label="Put it aside until later">
                    {trigger}
                  </ActionButton>
                )}
              />
            ))}
          <ActionButton hotkey="h" label="Hide releases of this component">
            <Button size="sm" variant="outline" onClick={actions.onHide}>
              <EyeOffIcon data-icon="inline-start" />
              Hide…
            </Button>
          </ActionButton>
          {!repository.unsubscribed_at && (
            <ActionButton label="Stop watching this repository on GitHub">
              <Button
                size="sm"
                variant="outline"
                onClick={actions.onUnsubscribe}
                disabled={pending.unsubscribe}
              >
                {pending.unsubscribe ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <BellOffIcon data-icon="inline-start" />
                )}
                {pending.unsubscribe ? "Unsubscribing…" : "Unsubscribe"}
              </Button>
            </ActionButton>
          )}

          <div className="ml-auto flex items-center gap-2">
            <ActionButton hotkey="o" label="Open the release on GitHub">
              <Button size="sm" variant="ghost" asChild>
                <a href={release.html_url} target="_blank" rel="noopener noreferrer">
                  <TagIcon data-icon="inline-start" />
                  Release
                </a>
              </Button>
            </ActionButton>
            <ActionButton label="Open the repository on GitHub">
              <Button size="sm" variant="ghost" asChild>
                <a href={repository.html_url} target="_blank" rel="noopener noreferrer">
                  <BookMarkedIcon data-icon="inline-start" />
                  Repository
                </a>
              </Button>
            </ActionButton>
          </div>
        </div>
      </header>

      <ReleaseContent
        release={release}
        body={body}
        unreadCount={unreadCount}
        tab={contentTab}
        onTabChange={onContentTabChange}
      />
    </article>
  )
}

function NotificationsToggle({ muted, onToggle }: { muted: boolean; onToggle: () => void }) {
  return (
    <ActionButton
      hotkey="m"
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
        className={cn(muted && "text-muted-foreground")}
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
        {hotkey && <Kbd>{hotkey}</Kbd>}
      </TooltipContent>
    </Tooltip>
  )
}
