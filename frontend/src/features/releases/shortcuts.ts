import { VIEWS } from "@/lib/api/types"

import { VIEW_META } from "./view-meta"

/** Keys of the inbox shortcuts (``KeyboardEvent.key``), shared by the handlers and the hints. */
export const HOTKEYS = {
  next: "j",
  previous: "k",
  markRead: "e",
  snooze: "s",
  markUnread: "u",
  hide: "h",
  notifications: "m",
  open: "o",
  copyLink: "c",
  nextTab: "r",
  search: "/",
  close: "Escape",
  help: "?",
} as const

const viewLabels = VIEWS.map((view) => VIEW_META[view].label)

/** The keyboard shortcuts of the inbox, as listed in the shortcuts dialog. */
export const SHORTCUTS: ReadonlyArray<{ keys: readonly string[]; description: string }> = [
  { keys: [HOTKEYS.next, HOTKEYS.previous], description: "Next or previous release" },
  { keys: [HOTKEYS.markRead], description: "Mark as read" },
  { keys: [HOTKEYS.snooze], description: "Snooze" },
  { keys: [HOTKEYS.markUnread], description: "Mark as unread" },
  { keys: [HOTKEYS.hide], description: "Hide releases of this component" },
  { keys: [HOTKEYS.notifications], description: "Turn notifications for the repository on or off" },
  { keys: [HOTKEYS.open], description: "Open the release on GitHub" },
  { keys: [HOTKEYS.copyLink], description: "Copy the link to the release" },
  { keys: [HOTKEYS.nextTab], description: "Next tab: notes, what's new, README" },
  {
    keys: VIEWS.map((view) => VIEW_META[view].hotkey),
    description: `${viewLabels.slice(0, -1).join(", ")} or ${viewLabels.at(-1)}`,
  },
  { keys: [HOTKEYS.search], description: "Search" },
  { keys: [HOTKEYS.close], description: "Close the release" },
  { keys: [HOTKEYS.help], description: "Show keyboard shortcuts" },
]

/** How a key is shown in hints. */
export function keyLabel(key: string): string {
  return key === "Escape" ? "Esc" : key
}
