import { MousePointerClickIcon, SearchXIcon } from "lucide-react"

import { EmptyState } from "@/components/empty-state"
import { ErrorState } from "@/components/error-state"
import { KeyHint } from "@/components/key-hint"
import { KbdGroup } from "@/components/ui/kbd"
import { Skeleton } from "@/components/ui/skeleton"
import { isNotFound } from "@/lib/api/client"
import { HOTKEYS } from "@/lib/hotkeys"

/** The detail pane while nothing is selected. */
export function NoSelection() {
  return (
    <EmptyState
      icon={MousePointerClickIcon}
      title="Select a release"
      description="Pick a release from the list to read its notes and the repository's README."
      className="h-full"
    >
      <p className="flex items-center gap-2 text-xs text-muted-foreground pointer-coarse:hidden">
        <KbdGroup>
          <KeyHint hotkey={HOTKEYS.next} />
          <KeyHint hotkey={HOTKEYS.previous} />
        </KbdGroup>
        to move through releases, <KeyHint hotkey={HOTKEYS.help} /> for all shortcuts
      </p>
    </EmptyState>
  )
}

/** The detail pane when the selected release couldn't be loaded. */
export function MissingRelease({ error, onRetry }: { error: Error; onRetry: () => void }) {
  if (!isNotFound(error)) {
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
    <EmptyState
      icon={SearchXIcon}
      title="Release not found"
      description="It may have been deleted on GitHub."
      className="h-full"
    />
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
