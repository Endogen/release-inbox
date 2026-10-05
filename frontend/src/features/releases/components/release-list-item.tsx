import { BellOffIcon, CheckIcon, LockIcon } from "lucide-react"
import type { Ref } from "react"

import { RelativeTime } from "@/components/relative-time"
import { RepoAvatar } from "@/components/repo-avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useSwipe, type SwipeDirection } from "@/hooks/use-swipe"
import type { ReleaseListItem as ReleaseListItemData } from "@/lib/api/types"
import { cn } from "@/lib/utils"

import { releaseTitle } from "../release-title"

interface ReleaseListItemProps {
  ref?: Ref<HTMLLIElement>
  release: ReleaseListItemData
  selected: boolean
  onSelect: () => void
  /** Enables the hover button and swiping left. */
  onMarkRead?: () => void
  /** Enables swiping right. */
  onUnsubscribe?: () => void
}

export function ReleaseListItem({
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
  const swipe = useSwipe({ onSwipeLeft: onMarkRead, onSwipeRight: onUnsubscribe })

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
          onClick={onSelect}
          aria-current={selected || undefined}
          aria-label={`${repository.full_name} ${title}`}
          className="absolute inset-0 rounded-none outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
        />
        <RepoAvatar repository={repository} className="pointer-events-none mt-0.5 size-9" />
        <div className="pointer-events-none flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="truncate">{repository.full_name}</span>
            {repository.private && <LockIcon className="size-3 shrink-0" aria-label="Private" />}
            <RelativeTime
              date={release.published_at}
              format="short"
              className={cn(
                "pointer-events-auto ml-auto shrink-0 tabular-nums transition-opacity",
                onMarkRead && "group-hover/row:opacity-0"
              )}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium">{title}</span>
            {release.prerelease && (
              <Badge variant="outline" className="shrink-0">
                Pre-release
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {showTag && <span className="truncate font-mono">{release.tag_name}</span>}
            {release.older_count > 0 && (
              <Badge variant="secondary" className="shrink-0">
                +{release.older_count} older
              </Badge>
            )}
          </div>
        </div>
        {onMarkRead && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Mark as read"
                onClick={onMarkRead}
                className="absolute top-2 right-2 opacity-0 transition-opacity group-hover/row:opacity-100 focus-visible:opacity-100"
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
    className: "bg-destructive text-white",
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
