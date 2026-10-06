import { MousePointerClickIcon, SearchXIcon } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"

import { AppHeader } from "@/components/app-header"
import { SearchInput } from "@/components/search-input"
import { ShortcutsDialog } from "@/components/shortcuts-dialog"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Kbd, KbdGroup } from "@/components/ui/kbd"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable"
import { Skeleton } from "@/components/ui/skeleton"
import { HideRuleDialog } from "@/features/hide-rules/components/hide-rule-dialog"
import { useSetRepositoryNotifications } from "@/features/repositories/api"
import { SettingsSheet } from "@/features/settings/settings-sheet"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import { useHotkeys } from "@/hooks/use-hotkeys"
import { useMediaQuery } from "@/hooks/use-media-query"
import type { Release } from "@/lib/api/types"

import { useMarkUnread, useRelease, useReleaseList, useViewCounts } from "./api"
import type { ContentTab } from "./components/release-content"
import { ReleaseDetail } from "./components/release-detail"
import { ReleaseList } from "./components/release-list"
import { ViewTabs } from "./components/view-tabs"
import { releaseTitle } from "./release-title"
import { useDeferredActions } from "./use-deferred-actions"
import { useInboxRoute } from "./use-inbox-route"

const SEARCH_DEBOUNCE_MS = 250

export function InboxPage({ username }: { username: string }) {
  const route = useInboxRoute()
  const isDesktop = useMediaQuery("(min-width: 1024px)")

  const [searchText, setSearchText] = useState(route.search)
  const debouncedSearch = useDebouncedValue(searchText.trim(), SEARCH_DEBOUNCE_MS)
  const { search, setSearch } = route
  useEffect(() => {
    if (debouncedSearch !== search) setSearch(debouncedSearch)
  }, [debouncedSearch, search, setSearch])

  const [contentTab, setContentTab] = useState<ContentTab>("notes")
  const [hideTarget, setHideTarget] = useState<Release | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  const list = useReleaseList(route.view, route.search)
  const counts = useViewCounts(route.search)
  const detail = useRelease(route.releaseId)
  const deferred = useDeferredActions()
  const { isHidden } = deferred
  const items = useMemo(
    () =>
      (list.data?.pages.flatMap((page) => page.items) ?? []).filter(
        (item) => !isHidden(item.repository.id, route.view)
      ),
    [list.data, isHidden, route.view]
  )
  const viewCounts = counts.data && {
    ...counts.data,
    [route.view]: Math.max(
      0,
      counts.data[route.view] -
        deferred.pending.filter((action) => action.hideFrom === route.view).length
    ),
  }

  const listItem = items.find((item) => item.id === route.releaseId)
  const selected: Release | undefined = detail.data ?? listItem
  const selectedIndex = selected
    ? items.findIndex((item) => item.repository.id === selected.repository.id)
    : -1

  const markUnread = useMarkUnread()
  const setNotifications = useSetRepositoryNotifications()

  /** Moves the selection off a release that is about to leave the current view. */
  function advanceFrom(release: Release) {
    if (selected?.repository.id !== release.repository.id) return
    if (!isDesktop) {
      route.selectRelease(null)
      return
    }
    const index = items.findIndex((item) => item.repository.id === release.repository.id)
    const next = items[index + 1] ?? items[index - 1]
    route.selectRelease(next?.id ?? null)
  }

  /** Undoable: the release and older ones are marked read once the undo toast closes. */
  function handleMarkRead(release: Release) {
    const leavesView = route.view === "inbox"
    if (leavesView) advanceFrom(release)
    deferred.schedule({
      id: `read-${release.repository.id}`,
      repositoryId: release.repository.id,
      hideFrom: leavesView ? route.view : null,
      path: `/releases/${release.id}/read`,
      message: "Marked as read",
      description: `${release.repository.full_name} · ${releaseTitle(release)}`,
      errorMessage: "Couldn't mark as read",
    })
  }

  function handleMarkUnread(release: Release) {
    if (route.view === "read") advanceFrom(release)
    markUnread.mutate(
      { releaseId: release.id, repositoryId: release.repository.id },
      {
        onSuccess: () => toast.success("Moved back to the inbox"),
        onError: (error) => toast.error("Couldn't mark as unread", { description: error.message }),
      }
    )
  }

  /** Undoable: the repository is only unwatched on GitHub once the undo toast closes. */
  function handleUnsubscribe(release: Release) {
    const { repository } = release
    const leavesView = route.view === "inbox"
    if (leavesView) advanceFrom(release)
    deferred.schedule({
      id: `unsubscribe-${repository.id}`,
      repositoryId: repository.id,
      hideFrom: leavesView ? route.view : null,
      path: `/repositories/${repository.id}/unsubscribe`,
      message: `Unsubscribed from ${repository.full_name}`,
      description: "You won't get notifications from this repository anymore.",
      errorMessage: `Couldn't unsubscribe from ${repository.full_name}`,
    })
  }

  /** Applies immediately (it only affects this app); the toast offers to switch it back. */
  function handleToggleNotifications(release: Release) {
    const { repository } = release
    const enabled = repository.notifications_muted_at !== null
    const update = (value: boolean) =>
      setNotifications.mutateAsync({ repositoryId: repository.id, enabled: value })

    update(enabled).then(
      () =>
        toast.success(
          enabled
            ? `Notifications on for ${repository.full_name}`
            : `Notifications off for ${repository.full_name}`,
          {
            description: enabled
              ? "You'll get a push notification for new releases."
              : "New releases still show up in your inbox, without a push notification.",
            action: { label: "Undo", onClick: () => void update(!enabled) },
          }
        ),
      (error: Error) =>
        toast.error("Couldn't change notifications", { description: error.message })
    )
  }

  function moveSelection(delta: 1 | -1) {
    if (items.length === 0) return
    const index =
      selectedIndex === -1 ? 0 : Math.min(items.length - 1, Math.max(0, selectedIndex + delta))
    const next = items[index]
    if (next) route.selectRelease(next.id)
  }

  useHotkeys({
    j: () => moveSelection(1),
    k: () => moveSelection(-1),
    e: () => selected?.read_at === null && handleMarkRead(selected),
    u: () => selected?.read_at && handleMarkUnread(selected),
    h: () => selected && setHideTarget(selected),
    m: () => selected && handleToggleNotifications(selected),
    o: () => selected && window.open(selected.html_url, "_blank", "noopener,noreferrer"),
    r: () => setContentTab((tab) => (tab === "notes" ? "readme" : "notes")),
    "1": () => route.setView("inbox"),
    "2": () => route.setView("read"),
    "3": () => route.setView("hidden"),
    "/": () => searchRef.current?.focus(),
    "?": () => setShortcutsOpen(true),
    Escape: () => route.selectRelease(null),
  })

  const listPane = (
    <section aria-label="Releases" className="flex h-full min-h-0 flex-col">
      <div className="border-b p-3">
        <ViewTabs view={route.view} counts={viewCounts} onChange={route.setView} />
      </div>
      <ReleaseList
        view={route.view}
        search={route.search}
        items={items}
        isLoading={list.isPending}
        hasNextPage={list.hasNextPage}
        isFetchingNextPage={list.isFetchingNextPage}
        onLoadMore={list.fetchNextPage}
        isSelected={(item) => item.repository.id === selected?.repository.id}
        onSelect={(item) => route.selectRelease(item.id)}
        onMarkRead={route.view === "inbox" ? handleMarkRead : undefined}
        onUnsubscribe={route.view === "inbox" ? handleUnsubscribe : undefined}
      />
    </section>
  )

  const detailPane = selected ? (
    <ReleaseDetail
      release={selected}
      body={detail.data?.body}
      contentTab={contentTab}
      onContentTabChange={setContentTab}
      onSelectRelease={route.selectRelease}
      onBack={isDesktop ? undefined : () => route.selectRelease(null)}
      actions={{
        onToggleNotifications: () => handleToggleNotifications(selected),
        onMarkRead: () => handleMarkRead(selected),
        onMarkUnread: () => handleMarkUnread(selected),
        onHide: () => setHideTarget(selected),
        onUnsubscribe: () => handleUnsubscribe(selected),
      }}
    />
  ) : route.releaseId !== null && detail.isPending ? (
    <DetailSkeleton />
  ) : route.releaseId !== null && detail.isError ? (
    <MissingRelease />
  ) : (
    <NoSelection />
  )

  return (
    <div className="flex h-dvh flex-col">
      <AppHeader
        username={username}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenShortcuts={() => setShortcutsOpen(true)}
        search={
          <SearchInput
            ref={searchRef}
            value={searchText}
            onChange={setSearchText}
            placeholder="Search repositories, releases and notes"
          />
        }
      />
      <main className="min-h-0 flex-1">
        {isDesktop ? (
          <ResizablePanelGroup orientation="horizontal">
            <ResizablePanel defaultSize="38%" minSize={340} maxSize="55%">
              {listPane}
            </ResizablePanel>
            <ResizableHandle />
            <ResizablePanel minSize={420}>{detailPane}</ResizablePanel>
          </ResizablePanelGroup>
        ) : route.releaseId !== null ? (
          detailPane
        ) : (
          listPane
        )}
      </main>

      <HideRuleDialog
        release={hideTarget}
        onOpenChange={(open) => !open && setHideTarget(null)}
      />
      <SettingsSheet open={settingsOpen} onOpenChange={setSettingsOpen} />
      <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
    </div>
  )
}

function NoSelection() {
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
            <Kbd>j</Kbd>
            <Kbd>k</Kbd>
          </KbdGroup>
          to move through releases, <Kbd>?</Kbd> for all shortcuts
        </p>
      </EmptyContent>
    </Empty>
  )
}

function MissingRelease() {
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

function DetailSkeleton() {
  return (
    <div className="flex flex-col gap-5 p-6" aria-busy aria-label="Loading release">
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
