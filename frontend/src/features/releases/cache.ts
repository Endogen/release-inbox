import type { InfiniteData, QueryClient } from "@tanstack/react-query"

import type { Release, ReleaseDetail, ReleasePage, View } from "@/lib/api/types"

import { releaseKeys } from "./query-keys"

/** Drop a repository's entry from the cached lists of a view (optimistic update). */
export function removeFromList(queryClient: QueryClient, view: View, repositoryId: number): void {
  queryClient.setQueriesData<InfiniteData<ReleasePage>>(
    { queryKey: releaseKeys.viewLists(view) },
    (data) => {
      if (!data) return data
      const pages = data.pages.map((page) => ({
        ...page,
        items: page.items.filter((item) => item.repository.id !== repositoryId),
      }))
      const removed = data.pages.reduce(
        (sum, page, index) => sum + page.items.length - (pages[index]?.items.length ?? 0),
        0
      )
      // Every page carries the total; pagination reads it from the last one.
      return { ...data, pages: pages.map((page) => ({ ...page, total: page.total - removed })) }
    }
  )
}

/** Set ``notifications_muted_at`` of a repository in the cached lists and details. */
export function setMutedEverywhere(
  queryClient: QueryClient,
  repositoryId: number,
  mutedAt: string | null
): void {
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
