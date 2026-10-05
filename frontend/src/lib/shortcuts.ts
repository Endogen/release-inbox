/** Keyboard shortcuts of the inbox, as listed in the shortcuts dialog. */
export const SHORTCUTS: ReadonlyArray<{ keys: string[]; description: string }> = [
  { keys: ["j", "k"], description: "Next or previous release" },
  { keys: ["e"], description: "Mark as read" },
  { keys: ["u"], description: "Mark as unread" },
  { keys: ["h"], description: "Hide releases of this component" },
  { keys: ["o"], description: "Open the release on GitHub" },
  { keys: ["r"], description: "Toggle release notes and README" },
  { keys: ["1", "2", "3"], description: "Inbox, Read or Hidden" },
  { keys: ["/"], description: "Search" },
  { keys: ["Esc"], description: "Close the release" },
  { keys: ["?"], description: "Show keyboard shortcuts" },
]
