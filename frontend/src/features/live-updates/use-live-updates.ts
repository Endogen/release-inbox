import { useQueryClient } from "@tanstack/react-query"
import { useEffect } from "react"

import { releaseKeys } from "@/features/releases/api"
import { syncKeys } from "@/features/sync/api"
import type { SyncStatus } from "@/lib/api/types"

interface SyncStatusEvent {
  in_progress: boolean
}

/** Keeps cached data fresh by listening to the server's event stream. */
export function useLiveUpdates(enabled: boolean): void {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!enabled) return

    const source = new EventSource("/api/events")

    source.addEventListener("releases-changed", () => {
      void queryClient.invalidateQueries({ queryKey: releaseKeys.all })
    })

    source.addEventListener("sync-status", (event: MessageEvent<string>) => {
      const { in_progress } = JSON.parse(event.data) as SyncStatusEvent
      queryClient.setQueryData<SyncStatus>(
        syncKeys.status,
        (status) => status && { ...status, in_progress }
      )
      if (!in_progress) void queryClient.invalidateQueries({ queryKey: syncKeys.status })
    })

    return () => source.close()
  }, [enabled, queryClient])
}
