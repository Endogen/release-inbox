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
  sync: "R",
  search: "/",
  close: "Escape",
  help: "?",
} as const

/** How a key is shown in hints. */
export function keyLabel(key: string): string {
  if (/^[A-Z]$/.test(key)) return `Shift + ${key}`
  return key === "Escape" ? "Esc" : key
}
