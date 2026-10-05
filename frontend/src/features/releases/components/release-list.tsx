import { CheckCheckIcon, EyeOffIcon, SearchXIcon, ArchiveIcon, type LucideIcon } from "lucide-react"
import { useEffect, useRef } from "react"

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import type { ReleaseListItem as ReleaseListItemData, View } from "@/lib/api/types"

import { ReleaseListItem } from "./release-list-item"

interface ReleaseListProps {
  view: View
  search: string
  items: ReleaseListItemData[]
  isLoading: boolean
  hasNextPage: boolean
  isFetchingNextPage: boolean
  onLoadMore: () => void
  isSelected: (release: ReleaseListItemData) => boolean
  onSelect: (release: ReleaseListItemData) => void
  onMarkRead?: (release: ReleaseListItemData) => void
}

export function ReleaseList({
  view,
  search,
  items,
  isLoading,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
  isSelected,
  onSelect,
  onMarkRead,
}: ReleaseListProps) {
  const selectedRef = useRef<HTMLLIElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const selectedId = items.find(isSelected)?.id

  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: "nearest" })
  }, [selectedId])

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel || !hasNextPage) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && !isFetchingNextPage) onLoadMore()
      },
      { rootMargin: "400px" }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, onLoadMore])

  if (isLoading) return <ReleaseListSkeleton />
  if (items.length === 0) return <ReleaseListEmpty view={view} search={search} />

  return (
    <ScrollArea className="min-h-0 flex-1">
      <ul aria-label="Releases" className="flex flex-col">
        {items.map((release) => {
          const selected = isSelected(release)
          return (
            <ReleaseListItem
              key={release.id}
              ref={selected ? selectedRef : undefined}
              release={release}
              selected={selected}
              onSelect={() => onSelect(release)}
              onMarkRead={onMarkRead && (() => onMarkRead(release))}
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
    <div className="flex flex-col" aria-busy aria-label="Loading releases">
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
  const { icon: Icon, title, description } = search
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
