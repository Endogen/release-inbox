import { useIsMutating, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { api } from "@/lib/api/client"
import type { SyncStatus } from "@/lib/api/types"
import { formatAbsolute } from "@/lib/time"

export const syncKeys = {
  status: ["sync"] as const,
  request: ["sync", "request"] as const,
}

function useSyncStatus() {
  return useQuery({
    queryKey: syncKeys.status,
    queryFn: ({ signal }) => api.get<SyncStatus>("/sync", { signal }),
    refetchInterval: 60_000,
  })
}

/**
 * The sync status and a way to sync now. A requested sync runs in the background; its
 * progress arrives through the live updates, which keep the status current.
 */
export function useSync() {
  const queryClient = useQueryClient()
  const status = useSyncStatus()
  const requesting = useIsMutating({ mutationKey: syncKeys.request }) > 0
  const request = useMutation({
    mutationKey: syncKeys.request,
    mutationFn: () => api.post<SyncStatus>("/sync"),
    meta: { errorMessage: "Couldn't start a sync" },
    onSuccess: (accepted) => {
      queryClient.setQueryData(syncKeys.status, accepted)
      if (!accepted.in_progress && accepted.rate_limited_until) {
        toast.info("GitHub asked to wait", {
          description: `The sync starts at ${formatAbsolute(accepted.rate_limited_until)}.`,
        })
      }
    },
  })
  const inProgress = requesting || (status.data?.in_progress ?? false)

  return {
    status: status.data,
    inProgress,
    /** Starts a sync unless one is already running. */
    syncNow: () => {
      if (!inProgress) request.mutate()
    },
  }
}
