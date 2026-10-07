import { useSyncExternalStore } from "react"

import { readStorage, writeStorage } from "@/lib/storage"

/** The tabs of a release, in order. */
export const CONTENT_TABS = ["notes", "changes", "readme"] as const
export type ContentTab = (typeof CONTENT_TABS)[number]

/** How the app looks on this device; kept in the browser, not synced. */
export interface DisplaySettings {
  /** Show repositories' star counts. */
  stars: boolean
  /** Smaller list rows, so more fit on the screen. */
  compactList: boolean
  /** "3h ago", or the date. */
  dates: "relative" | "absolute"
  /** The tab a release opens on; "What's new" falls back to the notes where there is none. */
  openOn: ContentTab
}

export const DEFAULT_DISPLAY_SETTINGS: DisplaySettings = {
  stars: true,
  compactList: false,
  dates: "relative",
  openOn: "notes",
}

const STORAGE_KEY = "ghr-display"

/** The stored settings; values that are missing or invalid get their default. */
export function parseDisplaySettings(stored: string | null): DisplaySettings {
  let value: unknown
  try {
    value = stored === null ? null : JSON.parse(stored)
  } catch {
    value = null
  }
  const saved =
    value !== null && typeof value === "object" ? (value as Record<string, unknown>) : {}
  const defaults = DEFAULT_DISPLAY_SETTINGS
  return {
    stars: typeof saved.stars === "boolean" ? saved.stars : defaults.stars,
    compactList: typeof saved.compactList === "boolean" ? saved.compactList : defaults.compactList,
    dates: saved.dates === "relative" || saved.dates === "absolute" ? saved.dates : defaults.dates,
    openOn: CONTENT_TABS.find((tab) => tab === saved.openOn) ?? defaults.openOn,
  }
}

let current = parseDisplaySettings(readStorage(STORAGE_KEY))
const listeners = new Set<() => void>()

function notify(): void {
  listeners.forEach((listener) => listener())
}

/** Changes made in another tab. */
function onStorage(event: StorageEvent): void {
  if (event.key !== STORAGE_KEY) return
  current = parseDisplaySettings(event.newValue)
  notify()
}

function subscribe(listener: () => void): () => void {
  if (listeners.size === 0) window.addEventListener("storage", onStorage)
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) window.removeEventListener("storage", onStorage)
  }
}

export function useDisplaySettings(): DisplaySettings {
  return useSyncExternalStore(subscribe, () => current)
}

export function updateDisplaySettings(changes: Partial<DisplaySettings>): void {
  current = { ...current, ...changes }
  writeStorage(STORAGE_KEY, JSON.stringify(current))
  notify()
}
