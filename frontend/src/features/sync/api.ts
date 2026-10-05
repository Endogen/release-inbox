import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { releaseKeys } from "@/features/releases/api"
import { api } from "@/lib/api/client"
import type { SyncStatus } from "@/lib/api/types"

export const syncKeys = {
  status: ["sync"] as const,
}

export function useSyncStatus() {
  return useQuery({
    queryKey: syncKeys.status,
    queryFn: ({ signal }) => api.get<SyncStatus>("/sync", { signal }),
    refetchInterval: 60_000,
  })
}

export function useSyncNow() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api.post<SyncStatus>("/sync"),
    onSuccess: (status) => {
      queryClient.setQueryData(syncKeys.status, status)
      return queryClient.invalidateQueries({ queryKey: releaseKeys.all })
    },
  })
}
