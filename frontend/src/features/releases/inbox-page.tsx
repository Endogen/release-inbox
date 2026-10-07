import { lazy, Suspense, useMemo, useRef, useState } from "react"
import { useDefaultLayout } from "react-resizable-panels"

import { AppHeader } from "@/features/shell/app-header"
import { ErrorBoundary } from "@/components/error-boundary"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable"
import { SyncBanner } from "@/features/sync/sync-banner"
import { useHasOpened } from "@/hooks/use-has-opened"
import { useHotkeys } from "@/hooks/use-hotkeys"
import { useMediaQuery } from "@/hooks/use-media-query"
import { useStableCallback } from "@/hooks/use-stable-callback"
import { VIEWS, type Release, type ReleaseListItem as ReleaseListItemData } from "@/lib/api/types"
import { cn } from "@/lib/utils"

import { useRelease, useReleaseList, useViewCounts } from "./api"
import { CONTENT_TABS, type ContentTab } from "./components/release-content"
import { ReleaseDetail } from "./components/release-detail"
import { ReleaseList } from "./components/release-list"
import { SearchBox } from "./components/search-box"
import { ViewTabs } from "./components/view-tabs"
import { useDeferredActions } from "./deferred-actions/context"
import { hiddenRepositories } from "./deferred-actions/queue"
import { DetailSkeleton, MissingRelease, NoSelection, PaneError } from "./inbox-states"
import { viewOf } from "./release-view"
import { HOTKEYS } from "./shortcuts"
import { useInboxRoute } from "./use-inbox-route"
import { useReleaseActions } from "./use-release-actions"
import { VIEW_META } from "./view-meta"

const PANEL_IDS = ["list", "detail"]

// Dialogs load the first time they open.
const HideRuleDialog = lazy(() =>
  import("@/features/hide-rules/hide-rule-dialog").then((module) => ({
    default: module.HideRuleDialog,
  }))
)
const SettingsSheet = lazy(() =>
  import("@/features/settings/settings-sheet").then((module) => ({
    default: module.SettingsSheet,
  }))
)
const ShortcutsDialog = lazy(() =>
  import("./components/shortcuts-dialog").then((module) => ({
    default: module.ShortcutsDialog,
  }))
)

export function InboxPage({ username }: { username: string }) {
  const route = useInboxRoute()
  const { view } = route
  const isDesktop = useMediaQuery("(min-width: 1024px)")
  const layout = useDefaultLayout({ id: "inbox-layout", panelIds: PANEL_IDS })

  const [contentTab, setContentTab] = useState<ContentTab>("notes")
  const [hideTarget, setHideTarget] = useState<Release | null>(null)
  /** The release whose snooze menu is open; it closes when the selection changes. */
  const [snoozeMenuFor, setSnoozeMenuFor] = useState<number | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const hideDialogUsed = useHasOpened(hideTarget !== null)
  const settingsUsed = useHasOpened(settingsOpen)
  const shortcutsUsed = useHasOpened(shortcutsOpen)

  const list = useReleaseList(view, route.search)
  const counts = useViewCounts(route.search)
  const detail = useRelease(route.releaseId)
  const { pending } = useDeferredActions()

  // Offset pages can overlap when new releases arrive between loads; keep one entry each.
  const loaded = useMemo(() => {
    const byRepository = new Map<number, ReleaseListItemData>()
    for (const item of list.data?.pages.flatMap((page) => page.items) ?? []) {
      if (!byRepository.has(item.repository.id)) byRepository.set(item.repository.id, item)
    }
    return byRepository
  }, [list.data])
  const hidden = useMemo(() => hiddenRepositories(pending, view), [pending, view])
  const items = useMemo(
    () => [...loaded.values()].filter((item) => !hidden.has(item.repository.id)),
    [loaded, hidden]
  )
  const viewCounts = counts.data && {
    ...counts.data,
    [view]: Math.max(0, counts.data[view] - (loaded.size - items.length)),
  }

  // While another version loads, the previous one stays visible (placeholder data).
  const current = detail.data?.id === route.releaseId ? detail.data : undefined
  const listItem = items.find((item) => item.id === route.releaseId)
  const selected: Release | undefined =
    current ?? listItem ?? (detail.isPlaceholderData ? detail.data : undefined)
  const entry = selected && loaded.get(selected.repository.id)
  const selectedIndex = selected
    ? items.findIndex((item) => item.repository.id === selected.repository.id)
    : -1
  /** "What's new" lists the unread releases an inbox entry stands for. */
  const whatsNewCount =
    view === "inbox" && entry && entry.older_count > 0 ? entry.older_count + 1 : 0
  const contentTabs = CONTENT_TABS.filter((tab) => tab !== "changes" || whatsNewCount > 0)
  const shownTab = contentTabs.includes(contentTab) ? contentTab : "notes"

  const actions = useReleaseActions({
    view,
    search: route.search,
    entryOf: (repositoryId) => loaded.get(repositoryId),
    onLeave: (release) => {
      if (selected?.repository.id !== release.repository.id) return
      if (!isDesktop) {
        route.closeRelease()
        return
      }
      const next = items[selectedIndex + 1] ?? items[selectedIndex - 1]
      route.selectRelease(next?.id ?? null)
    },
  })

  const openRelease = useStableCallback((release: ReleaseListItemData) =>
    route.selectRelease(release.id, { push: !isDesktop && route.releaseId === null })
  )
  const markReadFromList = useStableCallback(actions.markRead)
  const unsubscribeFromList = useStableCallback(actions.unsubscribe)
  const copyLinkFromList = useStableCallback(actions.copyLink)
  // Rows offer the quick actions where entries are unread.
  const rowActions = view === "inbox" || view === "snoozed"

  function moveSelection(delta: 1 | -1) {
    if (items.length === 0) return
    const index =
      selectedIndex === -1 ? 0 : Math.min(items.length - 1, Math.max(0, selectedIndex + delta))
    const next = items[index]
    if (next) route.selectRelease(next.id)
  }

  function cycleContentTab() {
    const index = contentTabs.indexOf(shownTab)
    setContentTab(contentTabs[(index + 1) % contentTabs.length] ?? "notes")
  }

  const viewHotkeys = Object.fromEntries(
    VIEWS.map((name) => [VIEW_META[name].hotkey, () => route.setView(name)])
  )

  useHotkeys(
    {
      [HOTKEYS.next]: () => moveSelection(1),
      [HOTKEYS.previous]: () => moveSelection(-1),
      [HOTKEYS.markRead]: () => selected?.read_at === null && actions.markRead(selected),
      [HOTKEYS.markUnread]: () => selected?.read_at && actions.markUnread(selected),
      // Snoozed releases offer "Unsnooze" instead of the menu.
      [HOTKEYS.snooze]: () =>
        selected && viewOf(selected, Date.now()) === "inbox" && setSnoozeMenuFor(selected.id),
      [HOTKEYS.hide]: () => selected && setHideTarget(selected),
      [HOTKEYS.notifications]: () => selected && actions.toggleNotifications(selected),
      [HOTKEYS.open]: () =>
        selected && window.open(selected.html_url, "_blank", "noopener,noreferrer"),
      [HOTKEYS.copyLink]: () => selected && actions.copyLink(selected),
      [HOTKEYS.nextTab]: cycleContentTab,
      ...viewHotkeys,
      [HOTKEYS.search]: () => searchRef.current?.focus(),
      [HOTKEYS.help]: () => setShortcutsOpen(true),
      [HOTKEYS.close]: () => route.closeRelease(),
    },
    { repeatable: [HOTKEYS.next, HOTKEYS.previous] }
  )

  const listPane = (
    <section aria-label="Releases" className="flex h-full min-h-0 flex-col">
      <div className="flex flex-col gap-3 border-b p-3">
        <ViewTabs view={view} counts={viewCounts} search={route.search} />
        <SyncBanner />
      </div>
      <ErrorBoundary key={view} fallback={(reset) => <PaneError onRetry={reset} />}>
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
          onMarkRead={rowActions ? markReadFromList : undefined}
          onUnsubscribe={rowActions ? unsubscribeFromList : undefined}
          onCopyLink={copyLinkFromList}
        />
      </ErrorBoundary>
    </section>
  )

  const detailContent = selected ? (
    <ReleaseDetail
      release={selected}
      body={selected.id === current?.id ? current.body : undefined}
      whatsNewCount={whatsNewCount}
      search={route.search}
      contentTab={shownTab}
      onContentTabChange={setContentTab}
      onSelectRelease={(id) => route.selectRelease(id)}
      onBack={isDesktop ? undefined : route.closeRelease}
      focusOnOpen={!isDesktop}
      showStars={!isDesktop}
      snoozeMenuOpen={snoozeMenuFor === selected.id}
      onSnoozeMenuOpenChange={(open) => setSnoozeMenuFor(open ? selected.id : null)}
      pending={{
        markRead: actions.isPending.markRead(selected),
        unsubscribe: actions.isPending.unsubscribe(selected.repository),
      }}
      actions={{
        onToggleNotifications: () => actions.toggleNotifications(selected),
        onMarkRead: () => actions.markRead(selected),
        onMarkUnread: () => actions.markUnread(selected),
        onHide: () => setHideTarget(selected),
        onUnsubscribe: () => actions.unsubscribe(selected),
        onSnooze: (until) => actions.snooze(selected, until),
        onUnsnooze: () => actions.unsnooze(selected),
        onCopyLink: () => actions.copyLink(selected),
      }}
    />
  ) : route.releaseId !== null && detail.isPending ? (
    <DetailSkeleton />
  ) : route.releaseId !== null && detail.isError ? (
    <MissingRelease error={detail.error} onRetry={() => void detail.refetch()} />
  ) : (
    <NoSelection />
  )
  const detailPane = (
    // A failure resets with the next repository; switching versions keeps the pane mounted.
    <ErrorBoundary
      key={selected?.repository.id ?? route.releaseId}
      fallback={(reset) => <PaneError onRetry={reset} />}
    >
      {detailContent}
    </ErrorBoundary>
  )

  const showDetailOnMobile = route.releaseId !== null

  return (
    <div className="flex h-dvh flex-col">
      <AppHeader
        username={username}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenShortcuts={() => setShortcutsOpen(true)}
        search={<SearchBox ref={searchRef} value={route.search} onCommit={route.setSearch} />}
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

      <Suspense>
        {hideDialogUsed && (
          <HideRuleDialog
            release={hideTarget}
            onOpenChange={(open) => !open && setHideTarget(null)}
          />
        )}
        {settingsUsed && <SettingsSheet open={settingsOpen} onOpenChange={setSettingsOpen} />}
        {shortcutsUsed && <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />}
      </Suspense>
    </div>
  )
}
