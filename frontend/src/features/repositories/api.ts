import {
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from "@tanstack/react-query"

import { releaseKeys } from "@/features/releases/api"
import { api } from "@/lib/api/client"
import type { Release, ReleaseDetail, ReleasePage, Repository } from "@/lib/api/types"

export const repositoryKeys = {
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
    onMutate: async ({ repositoryId, enabled }) => {
      await queryClient.cancelQueries({ queryKey: releaseKeys.all })
      const snapshot = queryClient.getQueriesData({ queryKey: releaseKeys.all })
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

/** Update ``notifications_muted_at`` of a repository in the cached lists and details. */
function setMutedEverywhere(
  queryClient: QueryClient,
  repositoryId: number,
  mutedAt: string | null
) {
  function withMute<T extends Release>(release: T): T {
    return release.repository.id === repositoryId
      ? { ...release, repository: { ...release.repository, notifications_muted_at: mutedAt } }
      : release
  }

  queryClient.setQueriesData<InfiniteData<ReleasePage>>(
    { queryKey: releaseKeys.lists() },
    (data) =>
      data && {
        ...data,
        pages: data.pages.map((page) => ({ ...page, items: page.items.map(withMute) })),
      }
  )
  queryClient.setQueriesData<ReleaseDetail>(
    { queryKey: releaseKeys.details() },
    (data) => data && withMute(data)
  )
}
