import {
  AlarmClockIcon,
  ArchiveIcon,
  CheckCheckIcon,
  EyeOffIcon,
  SearchXIcon,
  type LucideIcon,
} from "lucide-react"
import { useEffect, useRef } from "react"

import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import type { ReleaseListItem as ReleaseListItemData, View } from "@/lib/api/types"

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
}: ReleaseListProps) {
  const listRef = useRef<HTMLUListElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const selectedRef = useRef<HTMLLIElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const selectedId = items.find((item) => item.repository.id === selectedRepositoryId)?.id

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
  }, [hasNextPage, isFetchingNextPage, onLoadMore])

  if (isLoading) return <ReleaseListSkeleton />
  if (items.length === 0) return <ReleaseListEmpty view={view} search={search} />

  return (
    <ScrollArea viewportRef={viewportRef} className="min-h-0 flex-1">
      <ul ref={listRef} aria-label="Releases" className="flex flex-col">
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
      className="flex min-h-0 flex-1 flex-col overflow-hidden"
      aria-busy
      aria-label="Loading releases"
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

const EMPTY_STATES: Record<View, { icon: LucideIcon; title: string; description: string }> = {
  inbox: {
    icon: CheckCheckIcon,
    title: "You're all caught up",
    description: "New releases from repositories you watch will show up here.",
  },
  snoozed: {
    icon: AlarmClockIcon,
    title: "Nothing snoozed",
    description: "Snooze a release to put it aside; it comes back to the inbox when it's time.",
  },
  read: {
    icon: ArchiveIcon,
    title: "No read releases yet",
    description: "Releases you mark as read are kept here for later.",
  },
  hidden: {
    icon: EyeOffIcon,
    title: "Nothing hidden",
    description: "Hide releases of a component you don't care about to keep your inbox focused.",
  },
}

function ReleaseListEmpty({ view, search }: { view: View; search: string }) {
  const {
    icon: Icon,
    title,
    description,
  } = search
    ? {
        icon: SearchXIcon,
        title: "No matches",
        description: `Nothing in this view matches "${search}".`,
      }
    : EMPTY_STATES[view]

  return (
    <Empty className="flex-1">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Icon />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}
