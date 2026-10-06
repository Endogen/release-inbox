import { MousePointerClickIcon, SearchXIcon } from "lucide-react"

import { ErrorState } from "@/components/error-state"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Kbd, KbdGroup } from "@/components/ui/kbd"
import { Skeleton } from "@/components/ui/skeleton"
import { ApiError } from "@/lib/api/client"

import { HOTKEYS } from "./shortcuts"

/** The detail pane while nothing is selected. */
export function NoSelection() {
  return (
    <Empty className="h-full">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <MousePointerClickIcon />
        </EmptyMedia>
        <EmptyTitle>Select a release</EmptyTitle>
        <EmptyDescription>
          Pick a release from the list to read its notes and the repository's README.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <KbdGroup>
            <Kbd>{HOTKEYS.next}</Kbd>
            <Kbd>{HOTKEYS.previous}</Kbd>
          </KbdGroup>
          to move through releases, <Kbd>{HOTKEYS.help}</Kbd> for all shortcuts
        </p>
      </EmptyContent>
    </Empty>
  )
}

/** The detail pane when the selected release couldn't be loaded. */
export function MissingRelease({ error, onRetry }: { error: Error; onRetry: () => void }) {
  if (!(error instanceof ApiError && error.status === 404)) {
    return (
      <ErrorState
        className="h-full"
        title="Couldn't load the release"
        description="The server didn't respond. Try again in a moment."
        onAction={onRetry}
      />
    )
  }
  return (
    <Empty className="h-full">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <SearchXIcon />
        </EmptyMedia>
        <EmptyTitle>Release not found</EmptyTitle>
        <EmptyDescription>It may have been deleted on GitHub.</EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}

export function DetailSkeleton() {
  return (
    <div role="status" aria-label="Loading release" className="flex flex-col gap-5 p-6">
      <div className="flex items-center gap-3">
        <Skeleton className="size-10 rounded-lg" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
      <Skeleton className="h-8 w-2/5" />
      <Skeleton className="h-5 w-3/5" />
      <div className="flex gap-2">
        <Skeleton className="h-8 w-28" />
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-28" />
      </div>
    </div>
  )
}

/** Replaces a pane whose content failed to render. */
export function PaneError({ onRetry }: { onRetry: () => void }) {
  return (
    <ErrorState
      className="h-full"
      title="Something went wrong"
      description="This part of the page ran into an unexpected error."
      onAction={onRetry}
    />
  )
}
