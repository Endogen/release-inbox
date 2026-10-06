import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { api } from "@/lib/api/client"
import type { SyncStatus } from "@/lib/api/types"
import { formatAbsolute } from "@/lib/time"

export const syncKeys = {
  status: ["sync"] as const,
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
  const request = useMutation({
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

  return {
    status: status.data,
    inProgress: request.isPending || (status.data?.in_progress ?? false),
    syncNow: () => request.mutate(),
  }
}
