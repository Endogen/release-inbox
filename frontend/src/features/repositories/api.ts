import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { releaseKeys } from "@/features/releases/api"
import { api } from "@/lib/api/client"
import type { Repository } from "@/lib/api/types"

export const repositoryKeys = {
  muted: ["repositories", "muted"] as const,
}

/** Repositories whose new releases don't trigger push notifications. */
export function useMutedRepositories() {
  return useQuery({
    queryKey: repositoryKeys.muted,
    queryFn: ({ signal }) => api.get<Repository[]>("/repositories/muted", { signal }),
  })
}

export function useSetRepositoryNotifications() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ repositoryId, enabled }: { repositoryId: number; enabled: boolean }) =>
      api.put<Repository>(`/repositories/${repositoryId}/notifications`, { enabled }),
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: repositoryKeys.muted }),
        queryClient.invalidateQueries({ queryKey: releaseKeys.all }),
      ]),
  })
}
