import { cn } from "cn"
import { AlarmClockIcon, BellOffIcon, CheckIcon, LockIcon } from "lucide-react"
import { memo, type Ref } from "react"

import { RepoAvatar } from "@/components/avatars"
import { Hint } from "@/components/hint"
import { Timestamp } from "@/components/timestamp"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useRowGestures, type SwipeDirection } from "@/hooks/use-row-gestures"
import type { ReleaseListItem as ReleaseListItemData } from "@/lib/api/types"
import { useDisplaySettings } from "@/lib/display-settings"
import { formatAbsolute } from "@/lib/time"

import { releaseTitle } from "../release-title"
import { BreakingBadge, PrereleaseBadge } from "./release-badges"
import { StarCount } from "./star-count"

export interface ReleaseRowHandlers {
  onSelect: (release: ReleaseListItemData) => void
  /** Enables the hover button and swiping left. */
  onMarkRead?: (release: ReleaseListItemData) => void
  /** Enables swiping right. */
  onUnsubscribe?: (release: ReleaseListItemData) => void
  /** Enables a long press (touch screens). */
  onCopyLink?: (release: ReleaseListItemData) => void
}

interface ReleaseListItemProps extends ReleaseRowHandlers {
  ref?: Ref<HTMLLIElement>
  release: ReleaseListItemData
  selected: boolean
}

/** Memoized: handlers must be stable (see ``useStableCallback``) to avoid re-rendering. */
export const ReleaseListItem = memo(function ReleaseListItem({
  ref,
  release,
  selected,
  onSelect,
  onMarkRead,
  onUnsubscribe,
  onCopyLink,
}: ReleaseListItemProps) {
  const { repository } = release
  const { stars, compactList } = useDisplaySettings()
  const title = releaseTitle(release)
  const showTag = title !== release.tag_name
  const canUnsubscribe = onUnsubscribe && !repository.unsubscribed_at
  const gestures = useRowGestures({
    onSwipeLeft: onMarkRead && (() => onMarkRead(release)),
    onSwipeRight: canUnsubscribe ? () => onUnsubscribe(release) : undefined,
    onLongPress: onCopyLink && (() => onCopyLink(release)),
  })

  return (
    <li ref={ref} className="relative overflow-hidden border-b border-border/60">
      {gestures.direction && <SwipeAction direction={gestures.direction} armed={gestures.armed} />}
      <div
        {...gestures.handlers}
        data-selected={selected || undefined}
        data-held={gestures.held || undefined}
        style={{ transform: gestures.offset ? `translateX(${gestures.offset}px)` : undefined }}
        className={cn(
          // No text selection or callout menu: a long press on the row copies its link.
          "group/row relative flex touch-pan-y bg-background px-4 select-none [-webkit-touch-callout:none]",
          compactList ? "gap-2.5 py-2" : "gap-3 py-3",
          "before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:bg-primary before:opacity-0 before:transition-opacity",
          "hover:bg-muted/50 data-held:bg-muted data-selected:bg-muted data-selected:before:opacity-100",
          gestures.phase !== "dragging" &&
            "transition-[transform,background-color] duration-200 ease-out"
        )}
      >
        <button
          type="button"
          data-row-button
          onClick={() => onSelect(release)}
          aria-current={selected || undefined}
          aria-label={`${repository.full_name} ${title}`}
          className="absolute inset-0 rounded-none outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
        />
        <RepoAvatar
          repository={repository}
          className={cn("pointer-events-none mt-0.5", compactList ? "size-7" : "size-9")}
        />
        <div
          className={cn(
            "pointer-events-none flex min-w-0 flex-1 flex-col",
            !compactList && "gap-0.5"
          )}
        >
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="truncate">{repository.full_name}</span>
            {repository.private && <LockIcon className="size-3 shrink-0" aria-label="Private" />}
            {repository.notifications_muted_at && (
              <BellOffIcon className="size-3 shrink-0" aria-label="Notifications off" />
            )}
            {stars && repository.stargazers_count !== null && (
              <StarCount count={repository.stargazers_count} />
            )}
            <Timestamp
              date={release.published_at}
              format="short"
              className={cn(
                "ml-auto shrink-0 tabular-nums transition-opacity",
                onMarkRead && "pointer-fine:group-hover/row:opacity-0"
              )}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="min-w-16 truncate text-sm font-medium">{title}</span>
            {release.breaking && <BreakingBadge />}
            {release.prerelease && <PrereleaseBadge />}
            {/* Compact rows have two lines: the entry's state moves up, the tag is left out. */}
            {compactList && <EntryState release={release} />}
          </div>
          {!compactList && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {showTag && <span className="truncate font-mono">{release.tag_name}</span>}
              <EntryState release={release} />
            </div>
          )}
        </div>
        {onMarkRead && (
          // Only for mice and trackpads: on touch screens there is no hover, and an invisible
          // button over the timestamp would catch taps meant to open the release.
          <Hint label="Mark as read">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Mark as read"
              onClick={() => onMarkRead(release)}
              className="absolute top-2 right-2 hidden opacity-0 transition-opacity pointer-fine:inline-flex pointer-fine:group-hover/row:opacity-100 pointer-fine:focus-visible:opacity-100"
            >
              <CheckIcon />
            </Button>
          </Hint>
        )}
      </div>
    </li>
  )
})

/** What else the entry stands for, and until when it is snoozed. */
function EntryState({ release }: { release: ReleaseListItemData }) {
  return (
    <>
      {release.older_count > 0 && (
        <Badge variant="secondary" className="shrink-0">
          +{release.older_count} older
        </Badge>
      )}
      {release.snoozed_until && (
        <Badge variant="outline" className="shrink-0">
          <AlarmClockIcon data-icon="inline-start" />
          Until {formatAbsolute(release.snoozed_until)}
        </Badge>
      )}
    </>
  )
}

const SWIPE_ACTIONS = {
  left: {
    label: "Mark as read",
    icon: CheckIcon,
    className: "flex-row-reverse bg-primary text-primary-foreground",
  },
  right: {
    label: "Unsubscribe",
    icon: BellOffIcon,
    className: "bg-destructive text-destructive-foreground",
  },
} as const

/** The action revealed behind a row while it is swiped. */
function SwipeAction({ direction, armed }: { direction: SwipeDirection; armed: boolean }) {
  const { label, icon: Icon, className } = SWIPE_ACTIONS[direction]
  return (
    <div
      aria-hidden
      className={cn(
        "absolute inset-0 flex items-center gap-2 px-6 text-sm font-medium transition-opacity",
        className,
        armed ? "opacity-100" : "opacity-60"
      )}
    >
      <Icon className={cn("size-5 transition-transform duration-150", armed && "scale-125")} />
      {label}
    </div>
  )
}
