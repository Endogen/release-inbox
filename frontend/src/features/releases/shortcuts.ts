import { VIEWS } from "@/lib/api/types"

import { VIEW_META } from "./view-meta"

const viewLabels = VIEWS.map((view) => VIEW_META[view].label)

/** Keyboard shortcuts of the inbox, as listed in the shortcuts dialog. */
export const SHORTCUTS: ReadonlyArray<{ keys: readonly string[]; description: string }> = [
  { keys: ["j", "k"], description: "Next or previous release" },
  { keys: ["e"], description: "Mark as read" },
  { keys: ["s"], description: "Snooze" },
  { keys: ["u"], description: "Mark as unread" },
  { keys: ["h"], description: "Hide releases of this component" },
  { keys: ["m"], description: "Turn notifications for the repository on or off" },
  { keys: ["o"], description: "Open the release on GitHub" },
  { keys: ["r"], description: "Next tab: notes, what's new, README" },
  {
    keys: VIEWS.map((view) => VIEW_META[view].hotkey),
    description: `${viewLabels.slice(0, -1).join(", ")} or ${viewLabels.at(-1)}`,
  },
  { keys: ["/"], description: "Search" },
  { keys: ["Esc"], description: "Close the release" },
  { keys: ["?"], description: "Show keyboard shortcuts" },
]
