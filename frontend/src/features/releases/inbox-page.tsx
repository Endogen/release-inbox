import { MousePointerClickIcon, RefreshCwIcon, SearchXIcon } from "lucide-react"
import { useMemo, useRef, useState } from "react"
import { useDefaultLayout } from "react-resizable-panels"
import { toast } from "sonner"

import { AppHeader } from "@/components/app-header"
import { SearchBox } from "@/components/search-box"
import { ShortcutsDialog } from "@/components/shortcuts-dialog"
import { Button } from "@/components/ui/button"
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
import { useDeferredActions } from "@/features/deferred-actions/context"
import { hiddenRepositories, type DeferredAction } from "@/features/deferred-actions/queue"
import { HideRuleDialog } from "@/features/hide-rules/components/hide-rule-dialog"
import { useSetRepositoryNotifications } from "@/features/repositories/api"
import { SettingsSheet } from "@/features/settings/settings-sheet"
import { useHotkeys } from "@/hooks/use-hotkeys"
import { useMediaQuery } from "@/hooks/use-media-query"
import { useStableCallback } from "@/hooks/use-stable-callback"
import { ApiError } from "@/lib/api/client"
import type { Release, ReleaseListItem as ReleaseListItemData, View } from "@/lib/api/types"
import { formatAbsolute } from "@/lib/time"
import { cn } from "@/lib/utils"

import {
  useMarkReadNow,
  useMarkUnread,
  useRelease,
  useReleaseList,
  useSnooze,
  useUnsnooze,
  useViewCounts,
} from "./api"
import type { ContentTab } from "./components/release-content"
import { ReleaseDetail } from "./components/release-detail"
import { ReleaseList } from "./components/release-list"
import { ViewTabs } from "./components/view-tabs"
import { releaseTitle } from "./release-title"
import { useInboxRoute } from "./use-inbox-route"
import { VIEW_META } from "./view-meta"

const CONTENT_TABS: readonly ContentTab[] = ["notes", "changes", "readme"]
const PANEL_IDS = ["list", "detail"]

export function InboxPage({ username }: { username: string }) {
  const route = useInboxRoute()
  const { view } = route
  const isDesktop = useMediaQuery("(min-width: 1024px)")
  const layout = useDefaultLayout({ id: "inbox-layout", panelIds: PANEL_IDS })

  const [contentTab, setContentTab] = useState<ContentTab>("notes")
  const [hideTarget, setHideTarget] = useState<Release | null>(null)
  const [snoozeMenuOpen, setSnoozeMenuOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  const list = useReleaseList(view, route.search)
  const counts = useViewCounts(route.search)
  const detail = useRelease(route.releaseId)
  const { queue, pending } = useDeferredActions()

  // Offset pages can overlap when new releases arrive between loads; keep one entry each.
  const loaded = useMemo(() => {
    const byRepository = new Map<number, ReleaseListItemData>()
    for (const item of list.data?.pages.flatMap((page) => page.items) ?? []) {
      if (!byRepository.has(item.repository.id)) byRepository.set(item.repository.id, item)
    }
    return [...byRepository.values()]
  }, [list.data])
  const hidden = useMemo(() => hiddenRepositories(pending, view), [pending, view])
  const items = useMemo(
    () => loaded.filter((item) => !hidden.has(item.repository.id)),
    [loaded, hidden]
  )
  const viewCounts = counts.data && {
    ...counts.data,
    [view]: Math.max(0, counts.data[view] - (loaded.length - items.length)),
  }

  const listItem = loaded.find((item) => item.id === route.releaseId)
  // While another version loads, the previous one stays visible (placeholder data).
  const current = detail.data?.id === route.releaseId ? detail.data : undefined
  const selected: Release | undefined =
    current ?? listItem ?? (detail.isPlaceholderData ? detail.data : undefined)
  const body = current?.body
  const repositoryEntry = selected
    ? loaded.find((item) => item.repository.id === selected.repository.id)
    : undefined
  const selectedIndex = selected
    ? items.findIndex((item) => item.repository.id === selected.repository.id)
    : -1

  const markUnread = useMarkUnread()
  const markReadNow = useMarkReadNow()
  const snooze = useSnooze()
  const unsnooze = useUnsnooze()
  const setNotifications = useSetRepositoryNotifications()

  const isPending = (kind: "read" | "unsubscribe", repositoryId: number) =>
    pending.some((action) => action.id === `${kind}-${repositoryId}`)

  /** Moves the selection off a repository that is about to leave the current view. */
  function advanceFrom(release: Release) {
    if (selected?.repository.id !== release.repository.id) return
    if (!isDesktop) {
      route.closeRelease()
      return
    }
    const next = items[selectedIndex + 1] ?? items[selectedIndex - 1]
    route.selectRelease(next?.id ?? null)
  }

  /** The entry only disappears if it is acted on as a whole (through its newest release). */
  function leavesView(release: Release, from: View): boolean {
    return view === from && repositoryEntry?.id === release.id
  }

  function schedule(release: Release, action: Omit<DeferredAction, "repositoryId">) {
    if (action.hideFrom) advanceFrom(release)
    queue.schedule({ ...action, repositoryId: release.repository.id })
  }

  function handleMarkRead(release: Release) {
    schedule(release, {
      id: `read-${release.repository.id}`,
      hideFrom: leavesView(release, "inbox") ? "inbox" : null,
      path: `/releases/${release.id}/read`,
      message: "Marked as read",
      description: `${release.repository.full_name} · ${releaseTitle(release)}`,
      errorMessage: "Couldn't mark as read",
    })
  }

  function handleUnsubscribe(release: Release) {
    const { repository } = release
    schedule(release, {
      id: `unsubscribe-${repository.id}`,
      hideFrom: leavesView(release, "inbox") ? "inbox" : null,
      path: `/repositories/${repository.id}/unsubscribe`,
      message: `Unsubscribed from ${repository.full_name}`,
      description: "You won't get notifications from this repository anymore.",
      errorMessage: `Couldn't unsubscribe from ${repository.full_name}`,
    })
  }

  function handleMarkUnread(release: Release) {
    if (leavesView(release, "read")) advanceFrom(release)
    const input = { releaseId: release.id, repositoryId: release.repository.id }
    markUnread.mutate(input, {
      onSuccess: () =>
        toast.success("Moved back to the inbox", {
          description: `${release.repository.full_name} · ${releaseTitle(release)}`,
          action: { label: "Undo", onClick: () => markReadNow.mutate(input) },
        }),
      onError: (error) => toast.error("Couldn't mark as unread", { description: error.message }),
    })
  }

  function handleSnooze(release: Release, until: Date) {
    if (leavesView(release, "inbox")) advanceFrom(release)
    const input = { releaseId: release.id, repositoryId: release.repository.id }
    snooze.mutate(
      { ...input, until },
      {
        onSuccess: () =>
          toast.success(`Snoozed until ${formatAbsolute(until)}`, {
            description: `${release.repository.full_name} · ${releaseTitle(release)}`,
            action: { label: "Undo", onClick: () => unsnooze.mutate(input) },
          }),
        onError: (error) => toast.error("Couldn't snooze", { description: error.message }),
      }
    )
  }

  function handleUnsnooze(release: Release) {
    if (leavesView(release, "snoozed")) advanceFrom(release)
    unsnooze.mutate(
      { releaseId: release.id, repositoryId: release.repository.id },
      {
        onSuccess: () => toast.success("Back in the inbox"),
        onError: (error) => toast.error("Couldn't unsnooze", { description: error.message }),
      }
    )
  }

  /** Applies immediately (it only affects this app); the toast offers to switch it back. */
  function handleToggleNotifications(release: Release) {
    const { repository } = release
    if (setNotifications.isPending && setNotifications.variables?.repositoryId === repository.id) {
      return
    }
    const enabled = repository.notifications_muted_at !== null
    const update = (value: boolean, onSuccess?: () => void) =>
      setNotifications.mutate(
        { repositoryId: repository.id, enabled: value },
        {
          onSuccess,
          onError: (error) =>
            toast.error("Couldn't change notifications", { description: error.message }),
        }
      )

    update(enabled, () =>
      toast.success(`Notifications ${enabled ? "on" : "off"} for ${repository.full_name}`, {
        description: enabled
          ? "You'll be notified about new releases."
          : "New releases still show up in your inbox, without a notification.",
        action: { label: "Undo", onClick: () => update(!enabled) },
      })
    )
  }

  const openRelease = useStableCallback((release: ReleaseListItemData) =>
    route.selectRelease(release.id, { push: !isDesktop && route.releaseId === null })
  )
  const markReadFromList = useStableCallback(handleMarkRead)
  const unsubscribeFromList = useStableCallback(handleUnsubscribe)

  function moveSelection(delta: 1 | -1) {
    if (items.length === 0) return
    const index =
      selectedIndex === -1 ? 0 : Math.min(items.length - 1, Math.max(0, selectedIndex + delta))
    const next = items[index]
    if (next) route.selectRelease(next.id)
  }

  function cycleContentTab() {
    const available = CONTENT_TABS.filter(
      (tab) => tab !== "changes" || (repositoryEntry?.older_count ?? 0) > 0
    )
    const index = available.indexOf(contentTab)
    setContentTab(available[(index + 1) % available.length] ?? "notes")
  }

  const viewHotkeys = Object.fromEntries(
    (Object.entries(VIEW_META) as [View, (typeof VIEW_META)[View]][]).map(([name, meta]) => [
      meta.hotkey,
      () => route.setView(name),
    ])
  )

  useHotkeys(
    {
      j: () => moveSelection(1),
      k: () => moveSelection(-1),
      e: () => selected?.read_at === null && handleMarkRead(selected),
      u: () => selected?.read_at && handleMarkUnread(selected),
      s: () => selected?.read_at === null && setSnoozeMenuOpen(true),
      h: () => selected && setHideTarget(selected),
      m: () => selected && handleToggleNotifications(selected),
      o: () => selected && window.open(selected.html_url, "_blank", "noopener,noreferrer"),
      r: cycleContentTab,
      ...viewHotkeys,
      "/": () => searchRef.current?.focus(),
      "?": () => setShortcutsOpen(true),
      Escape: () => route.closeRelease(),
    },
    { repeatable: ["j", "k"] }
  )

  const listPane = (
    <section aria-label="Releases" className="flex h-full min-h-0 flex-col">
      <div className="border-b p-3">
        <ViewTabs view={view} counts={viewCounts} search={route.search} />
      </div>
      <ReleaseList
        view={view}
        search={route.search}
        items={items}
        selectedRepositoryId={selected?.repository.id}
        isLoading={list.isPending}
        hasNextPage={list.hasNextPage}
        isFetchingNextPage={list.isFetchingNextPage}
        onLoadMore={list.fetchNextPage}
        onSelect={openRelease}
        onMarkRead={view === "inbox" ? markReadFromList : undefined}
        onUnsubscribe={view === "inbox" ? unsubscribeFromList : undefined}
      />
    </section>
  )

  const detailPane = selected ? (
    <ReleaseDetail
      release={selected}
      body={selected.id === current?.id ? body : undefined}
      unreadCount={view === "inbox" && repositoryEntry ? repositoryEntry.older_count + 1 : 0}
      contentTab={contentTab}
      onContentTabChange={setContentTab}
      onSelectRelease={(id) => route.selectRelease(id)}
      onBack={isDesktop ? undefined : route.closeRelease}
      focusOnOpen={!isDesktop}
      snoozeMenuOpen={snoozeMenuOpen}
      onSnoozeMenuOpenChange={setSnoozeMenuOpen}
      pending={{
        markRead: isPending("read", selected.repository.id),
        unsubscribe: isPending("unsubscribe", selected.repository.id),
      }}
      actions={{
        onToggleNotifications: () => handleToggleNotifications(selected),
        onMarkRead: () => handleMarkRead(selected),
        onMarkUnread: () => handleMarkUnread(selected),
        onHide: () => setHideTarget(selected),
        onUnsubscribe: () => handleUnsubscribe(selected),
        onSnooze: (until) => handleSnooze(selected, until),
        onUnsnooze: () => handleUnsnooze(selected),
      }}
    />
  ) : route.releaseId !== null && detail.isPending ? (
    <DetailSkeleton />
  ) : route.releaseId !== null && detail.isError ? (
    <MissingRelease error={detail.error} onRetry={() => void detail.refetch()} />
  ) : (
    <NoSelection />
  )

  const showDetailOnMobile = route.releaseId !== null

  return (
    <div className="flex h-dvh flex-col">
      <AppHeader
        username={username}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenShortcuts={() => setShortcutsOpen(true)}
        search={
          <SearchBox
            ref={searchRef}
            value={route.search}
            onCommit={route.setSearch}
            placeholder="Search repositories, releases and notes"
          />
        }
      />
      <main className="min-h-0 flex-1">
        {isDesktop ? (
          <ResizablePanelGroup
            orientation="horizontal"
            defaultLayout={layout.defaultLayout}
            onLayoutChanged={layout.onLayoutChanged}
          >
            <ResizablePanel id="list" defaultSize="38%" minSize={340} maxSize="55%">
              {listPane}
            </ResizablePanel>
            <ResizableHandle />
            <ResizablePanel id="detail" minSize={420}>
              {detailPane}
            </ResizablePanel>
          </ResizablePanelGroup>
        ) : (
          <>
            {/* The list stays mounted under the detail, so going back keeps its scroll. */}
            <div className={cn("h-full", showDetailOnMobile && "hidden")}>{listPane}</div>
            {showDetailOnMobile && detailPane}
          </>
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

function MissingRelease({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const notFound = error instanceof ApiError && error.status === 404
  return (
    <Empty className="h-full">
      <EmptyHeader>
        <EmptyMedia variant="icon">{notFound ? <SearchXIcon /> : <RefreshCwIcon />}</EmptyMedia>
        <EmptyTitle>{notFound ? "Release not found" : "Couldn't load the release"}</EmptyTitle>
        <EmptyDescription>
          {notFound ? "It may have been deleted on GitHub." : "The server didn't respond."}
        </EmptyDescription>
      </EmptyHeader>
      {!notFound && (
        <EmptyContent>
          <Button variant="outline" size="sm" onClick={onRetry}>
            Try again
          </Button>
        </EmptyContent>
      )}
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
