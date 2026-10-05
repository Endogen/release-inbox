import { CheckIcon, LockIcon } from "lucide-react"
import type { Ref } from "react"

import { RelativeTime } from "@/components/relative-time"
import { RepoAvatar } from "@/components/repo-avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { ReleaseListItem as ReleaseListItemData } from "@/lib/api/types"
import { cn } from "@/lib/utils"

import { releaseTitle } from "../release-title"

interface ReleaseListItemProps {
  ref?: Ref<HTMLLIElement>
  release: ReleaseListItemData
  selected: boolean
  onSelect: () => void
  onMarkRead?: () => void
}

export function ReleaseListItem({
  ref,
  release,
  selected,
  onSelect,
  onMarkRead,
}: ReleaseListItemProps) {
  const { repository } = release
  const title = releaseTitle(release)
  const showTag = title !== release.tag_name

  return (
    <li
      ref={ref}
      data-selected={selected || undefined}
      className={cn(
        "group/row relative flex gap-3 border-b border-border/60 px-4 py-3 transition-colors",
        "before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:bg-primary before:opacity-0 before:transition-opacity",
        "hover:bg-muted/50 data-selected:bg-muted data-selected:before:opacity-100"
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
            className="pointer-events-auto ml-auto shrink-0 tabular-nums transition-opacity group-hover/row:opacity-0"
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
    </li>
  )
}
