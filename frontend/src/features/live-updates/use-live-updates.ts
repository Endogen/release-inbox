import { useQueryClient } from "@tanstack/react-query"
import { useEffect } from "react"

import { authKeys } from "@/features/auth/api"
import { releaseKeys } from "@/features/releases/query-keys"
import { syncKeys } from "@/features/sync/api"
import type { SyncStatus } from "@/lib/api/types"

/** Reads the ``in_progress`` flag of a ``sync-status`` event; ``undefined`` if malformed. */
function readInProgress(data: string): boolean | undefined {
  try {
    const payload: unknown = JSON.parse(data)
    if (payload && typeof payload === "object" && "in_progress" in payload) {
      return typeof payload.in_progress === "boolean" ? payload.in_progress : undefined
    }
  } catch {
    // Not JSON; ignore the event like any other unknown message.
  }
  return undefined
}

const INITIAL_RETRY_MS = 2_000
const MAX_RETRY_MS = 60_000

/**
 * Keeps cached data fresh by listening to the server's event stream.
 *
 * ``EventSource`` reconnects by itself after network hiccups, but gives up for good on an
 * error response (a proxy's 502 during a restart, or 401 once the session expired). Then the
 * session is re-checked and the stream reopened with backoff. Every reconnect refetches, so
 * changes that happened while disconnected aren't missed.
 */
export function useLiveUpdates(enabled: boolean): void {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!enabled) return

    let source: EventSource | undefined
    let retryTimer: ReturnType<typeof setTimeout> | undefined
    let retryDelay = INITIAL_RETRY_MS
    let stopped = false
    // The first connection comes right after the page loaded its data.
    let connected = false

    const refreshReleases = () => queryClient.invalidateQueries({ queryKey: releaseKeys.all })

    function connect() {
      source = new EventSource("/api/events")

      source.addEventListener("open", () => {
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

      source.addEventListener("error", () => {
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
    }
  }, [enabled, queryClient])
}
