import { useHotkeys } from "@/hooks/use-hotkeys"
import { VIEWS, type Release, type View } from "@/lib/api/types"
import { HOTKEYS } from "@/lib/hotkeys"

import { viewOf } from "./release-view"
import type { useReleaseActions } from "./use-release-actions"
import { VIEW_META } from "./view-meta"

interface InboxHotkeyHandlers {
  selected: Release | undefined
  actions: ReturnType<typeof useReleaseActions>
  onMove: (delta: 1 | -1) => void
  onSnooze: (release: Release) => void
  onHide: (release: Release) => void
  onNextTab: () => void
  onView: (view: View) => void
  onSearch: () => void
  onHelp: () => void
  onClose: () => void
}

/** The keyboard shortcuts of the inbox, as listed in ``SHORTCUTS``. */
export function useInboxHotkeys({
  selected,
  actions,
  onMove,
  onSnooze,
  onHide,
  onNextTab,
  onView,
  onSearch,
  onHelp,
  onClose,
}: InboxHotkeyHandlers) {
  const viewHotkeys = Object.fromEntries(
    VIEWS.map((view) => [VIEW_META[view].hotkey, () => onView(view)])
  )

  useHotkeys(
    {
      [HOTKEYS.next]: () => onMove(1),
      [HOTKEYS.previous]: () => onMove(-1),
      [HOTKEYS.markRead]: () => selected?.read_at === null && actions.markRead(selected),
      [HOTKEYS.markUnread]: () => selected?.read_at && actions.markUnread(selected),
      // Snoozed releases offer "Unsnooze" instead of the menu.
      [HOTKEYS.snooze]: () =>
        selected && viewOf(selected, Date.now()) === "inbox" && onSnooze(selected),
      [HOTKEYS.hide]: () => selected && onHide(selected),
      [HOTKEYS.notifications]: () => selected && actions.toggleNotifications(selected),
      [HOTKEYS.open]: () =>
        selected && window.open(selected.html_url, "_blank", "noopener,noreferrer"),
      [HOTKEYS.copyLink]: () => selected && actions.copyLink(selected),
      [HOTKEYS.nextTab]: onNextTab,
      ...viewHotkeys,
      [HOTKEYS.search]: onSearch,
      [HOTKEYS.help]: onHelp,
      [HOTKEYS.close]: onClose,
    },
    { repeatable: [HOTKEYS.next, HOTKEYS.previous] }
  )
}
