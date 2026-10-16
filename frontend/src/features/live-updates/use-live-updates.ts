import { useQueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"

import { authKeys } from "@/features/auth/api"
import { releaseKeys } from "@/features/releases/query-keys"
import { syncKeys } from "@/features/sync/api"
import type { SyncStatus } from "@/lib/api/types"
import { isDesktop, showDesktopNotification } from "@/lib/desktop"

import { readInProgress, readNotification } from "./events"

const INITIAL_RETRY_MS = 2_000
const MAX_RETRY_MS = 60_000

/**
 * Keeps cached data fresh by listening to the server's event stream.
 *
 * ``EventSource`` reconnects by itself after network hiccups, but gives up for good on an
 * error response (a proxy's 502 during a restart, or 401 once the session expired). Then the
 * session is re-checked and the stream reopened with backoff. Every reconnect refetches, so
 * changes that happened while disconnected aren't missed.
 *
 * In the desktop app the stream also carries the notifications, which the desktop shows.
 *
 * Returns whether the stream is open; ``undefined`` until the first connection opened or
 * failed, and while disabled.
 */
export function useLiveUpdates(enabled: boolean): boolean | undefined {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState<boolean>()

  useEffect(() => {
    if (!enabled) return

    let source: EventSource | undefined
    let retryTimer: ReturnType<typeof setTimeout> | undefined
    let retryDelay = INITIAL_RETRY_MS
    let stopped = false
    // The first connection comes right after the page loaded its data.
    let connected = false

    const refreshReleases = () => queryClient.invalidateQueries({ queryKey: releaseKeys.all })
    const desktop = isDesktop()

    function connect() {
      source = new EventSource(desktop ? "/api/events?notifications=true" : "/api/events")

      source.addEventListener("open", () => {
        setOpen(true)
        retryDelay = INITIAL_RETRY_MS
        if (connected) void refreshReleases()
        connected = true
      })

      source.addEventListener("releases-changed", () => void refreshReleases())

      source.addEventListener("sync-status", (event: MessageEvent<string>) => {
        const in_progress = readInProgress(event.data)
        if (in_progress === undefined) return
        queryClient.setQueryData<SyncStatus>(
          syncKeys.status,
          (status) => status && { ...status, in_progress }
        )
        if (!in_progress) void queryClient.invalidateQueries({ queryKey: syncKeys.status })
      })

      source.addEventListener("notification", (event: MessageEvent<string>) => {
        const notification = readNotification(event.data)
        if (notification) void showDesktopNotification(notification)
      })

      source.addEventListener("error", () => {
        // Also while the browser reconnects by itself.
        if (!stopped) setOpen(false)
        if (source?.readyState !== EventSource.CLOSED || stopped) return
        // Re-checking the session shows the sign-in screen (and disables this hook) if
        // the session expired; otherwise try again later.
        void queryClient.invalidateQueries({ queryKey: authKeys.me })
        retryTimer = setTimeout(connect, retryDelay)
        retryDelay = Math.min(retryDelay * 2, MAX_RETRY_MS)
      })
    }

    connect()
    return () => {
      stopped = true
      clearTimeout(retryTimer)
      source?.close()
      setOpen(undefined)
    }
  }, [enabled, queryClient])

  return open
}
