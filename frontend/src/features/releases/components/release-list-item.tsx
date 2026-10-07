import { AlarmClockIcon, BellOffIcon, CheckIcon, LockIcon, StarIcon } from "lucide-react"
import { memo, type Ref } from "react"

import { RelativeTime } from "@/components/relative-time"
import { RepoAvatar } from "@/components/avatars"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useSwipe, type SwipeDirection } from "@/hooks/use-swipe"
import type { ReleaseListItem as ReleaseListItemData } from "@/lib/api/types"
import { formatCount } from "@/lib/format-count"
import { formatAbsolute } from "@/lib/time"
import { cn } from "@/lib/utils"

import { releaseTitle } from "../release-title"
import { BreakingBadge, PrereleaseBadge } from "./release-badges"

export interface ReleaseRowHandlers {
  onSelect: (release: ReleaseListItemData) => void
  /** Enables the hover button and swiping left. */
  onMarkRead?: (release: ReleaseListItemData) => void
  /** Enables swiping right. */
  onUnsubscribe?: (release: ReleaseListItemData) => void
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
}: ReleaseListItemProps) {
  const { repository } = release
  const title = releaseTitle(release)
  const showTag = title !== release.tag_name
  const canUnsubscribe = onUnsubscribe && !repository.unsubscribed_at
  const swipe = useSwipe({
    onSwipeLeft: onMarkRead && (() => onMarkRead(release)),
    onSwipeRight: canUnsubscribe ? () => onUnsubscribe(release) : undefined,
  })

  return (
    <li ref={ref} className="relative overflow-hidden border-b border-border/60">
      {swipe.direction && <SwipeAction direction={swipe.direction} armed={swipe.armed} />}
      <div
        {...swipe.handlers}
        data-selected={selected || undefined}
        style={{ transform: swipe.offset ? `translateX(${swipe.offset}px)` : undefined }}
        className={cn(
          "group/row relative flex touch-pan-y gap-3 bg-background px-4 py-3",
          "before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:bg-primary before:opacity-0 before:transition-opacity",
          "hover:bg-muted/50 data-selected:bg-muted data-selected:before:opacity-100",
          swipe.phase === "dragging"
            ? "select-none"
            : "transition-[transform,background-color] duration-200 ease-out"
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
        <RepoAvatar repository={repository} className="pointer-events-none mt-0.5 size-9" />
        <div className="pointer-events-none flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="truncate">{repository.full_name}</span>
            {repository.private && <LockIcon className="size-3 shrink-0" aria-label="Private" />}
            {repository.notifications_muted_at && (
              <BellOffIcon className="size-3 shrink-0" aria-label="Notifications off" />
            )}
            {repository.stargazers_count !== null && (
              <span className="flex shrink-0 items-center gap-0.5 tabular-nums">
                <StarIcon className="size-3" aria-hidden />
                {formatCount(repository.stargazers_count)}
                <span className="sr-only"> stars</span>
              </span>
            )}
            <RelativeTime
              date={release.published_at}
              format="short"
              className={cn(
                "pointer-events-auto ml-auto shrink-0 tabular-nums transition-opacity",
                onMarkRead && "pointer-fine:group-hover/row:opacity-0"
              )}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium">{title}</span>
            {release.breaking && <BreakingBadge />}
            {release.prerelease && <PrereleaseBadge />}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {showTag && <span className="truncate font-mono">{release.tag_name}</span>}
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
          </div>
        </div>
        {onMarkRead && (
          // Only for mice and trackpads: on touch screens there is no hover, and an invisible
          // button over the timestamp would catch taps meant to open the release.
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Mark as read"
                onClick={() => onMarkRead(release)}
                className="absolute top-2 right-2 hidden opacity-0 transition-opacity pointer-fine:inline-flex pointer-fine:group-hover/row:opacity-100 pointer-fine:focus-visible:opacity-100"
              >
                <CheckIcon />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Mark as read</TooltipContent>
          </Tooltip>
        )}
      </div>
    </li>
  )
})

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
