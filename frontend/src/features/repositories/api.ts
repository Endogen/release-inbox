import { useMutation, useQuery, useQueryClient, type QueryFilters } from "@tanstack/react-query"

import { releaseKeys } from "@/features/releases/query-keys"
import { setMutedEverywhere } from "@/features/releases/cache"
import { api } from "@/lib/api/client"
import type { Repository } from "@/lib/api/types"

const repositoryKeys = {
  muted: ["repositories", "muted"] as const,
}

/** Repositories whose new releases don't trigger notifications. */
export function useMutedRepositories() {
  return useQuery({
    queryKey: repositoryKeys.muted,
    queryFn: ({ signal }) => api.get<Repository[]>("/repositories/muted", { signal }),
  })
}

interface NotificationsInput {
  repositoryId: number
  enabled: boolean
}

export function useSetRepositoryNotifications() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ repositoryId, enabled }: NotificationsInput) =>
      api.put<Repository>(`/repositories/${repositoryId}/notifications`, { enabled }),
    meta: { errorMessage: "Couldn't change notifications" },
    onMutate: async ({ repositoryId, enabled }) => {
      const touched: QueryFilters[] = [
        { queryKey: releaseKeys.lists() },
        { queryKey: releaseKeys.details() },
      ]
      await Promise.all(touched.map((filters) => queryClient.cancelQueries(filters)))
      const snapshot = touched.flatMap((filters) => queryClient.getQueriesData(filters))
      setMutedEverywhere(queryClient, repositoryId, enabled ? null : new Date().toISOString())
      return { snapshot }
    },
    onError: (_error, _input, context) => {
      context?.snapshot.forEach(([key, data]) => queryClient.setQueryData(key, data))
    },
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: repositoryKeys.muted }),
        queryClient.invalidateQueries({ queryKey: releaseKeys.all }),
      ]),
  })
}
