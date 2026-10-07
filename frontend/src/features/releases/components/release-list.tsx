import { SearchXIcon } from "lucide-react"
import { useEffect, useRef } from "react"

import { EmptyState } from "@/components/empty-state"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import type { ReleaseListItem as ReleaseListItemData, View } from "@/lib/api/types"

import { VIEW_META } from "../view-meta"
import { ReleaseListItem, type ReleaseRowHandlers } from "./release-list-item"

interface ReleaseListProps extends ReleaseRowHandlers {
  view: View
  search: string
  items: readonly ReleaseListItemData[]
  /** Repository of the selected release; its entry is highlighted. */
  selectedRepositoryId: number | undefined
  isLoading: boolean
  hasNextPage: boolean
  isFetchingNextPage: boolean
  onLoadMore: () => void
}

/** Distance from the end of the list at which the next page starts loading. */
const PREFETCH_MARGIN = "600px"

export function ReleaseList({
  view,
  search,
  items,
  selectedRepositoryId,
  isLoading,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
  onSelect,
  onMarkRead,
  onUnsubscribe,
  onCopyLink,
}: ReleaseListProps) {
  const listRef = useRef<HTMLUListElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const selectedRef = useRef<HTMLLIElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const selectedId = items.find((item) => item.repository.id === selectedRepositoryId)?.id
  // Entries hidden by pending actions can empty the loaded pages while more exist.
  const showList = !isLoading && (items.length > 0 || hasNextPage)

  useEffect(() => {
    const row = selectedRef.current
    if (!row) return
    row.scrollIntoView({ block: "nearest" })
    // Keep keyboard focus on the selection unless the user is working elsewhere (detail
    // pane, search, dialogs). After an action removed the focused row, focus is on <body>.
    const active = document.activeElement
    if (active === document.body || listRef.current?.contains(active)) {
      row.querySelector<HTMLButtonElement>("[data-row-button]")?.focus({ preventScroll: true })
    }
  }, [selectedId])

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel || !hasNextPage) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && !isFetchingNextPage) onLoadMore()
      },
      // The list scrolls inside the ScrollArea, so observe relative to its viewport.
      { root: viewportRef.current, rootMargin: PREFETCH_MARGIN }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [showList, hasNextPage, isFetchingNextPage, onLoadMore])

  if (isLoading) return <ReleaseListSkeleton />
  if (!showList) return <ReleaseListEmpty view={view} search={search} />

  return (
    <ScrollArea viewportRef={viewportRef} className="min-h-0 flex-1">
      <ul ref={listRef} className="flex flex-col">
        {items.map((release) => {
          const selected = release.repository.id === selectedRepositoryId
          return (
            <ReleaseListItem
              key={release.repository.id}
              ref={selected ? selectedRef : undefined}
              release={release}
              selected={selected}
              onSelect={onSelect}
              onMarkRead={onMarkRead}
              onUnsubscribe={onUnsubscribe}
              onCopyLink={onCopyLink}
            />
          )
        })}
      </ul>
      <div ref={sentinelRef} className="flex justify-center py-4">
        {isFetchingNextPage && <Spinner />}
      </div>
    </ScrollArea>
  )
}

function ReleaseListSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading releases"
      className="flex min-h-0 flex-1 flex-col overflow-hidden"
    >
      {Array.from({ length: 8 }, (_, index) => (
        <div key={index} className="flex gap-3 border-b border-border/60 px-4 py-3">
          <Skeleton className="size-9 rounded-lg" />
          <div className="flex flex-1 flex-col gap-2 py-0.5">
            <Skeleton className="h-3 w-2/5" />
            <Skeleton className="h-4 w-3/5" />
            <Skeleton className="h-3 w-1/4" />
          </div>
        </div>
      ))}
    </div>
  )
}

function ReleaseListEmpty({ view, search }: { view: View; search: string }) {
  const empty = search
    ? {
        icon: SearchXIcon,
        title: "No matches",
        description: `Nothing in this view matches "${search}".`,
      }
    : VIEW_META[view].empty
  return <EmptyState {...empty} className="flex-1" />
}
