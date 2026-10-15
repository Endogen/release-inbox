import { useEffect } from "react"

import { useStableCallback } from "@/hooks/use-stable-callback"
import { isDesktop, onDesktopEvent } from "@/lib/desktop"

import { useSync } from "./api"

/** Runs "Sync now" from the desktop app's tray menu; renders nothing. */
export function DesktopTraySync() {
  return isDesktop() ? <TraySync /> : null
}

function TraySync() {
  const { syncNow } = useSync()
  const sync = useStableCallback(syncNow)
  useEffect(() => onDesktopEvent("desktop://sync", sync), [sync])
  return null
}
