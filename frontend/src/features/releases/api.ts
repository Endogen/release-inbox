import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from "@tanstack/react-query"

import { api } from "@/lib/api/client"
import type {
  Readme,
  ReleaseDetail,
  ReleasePage,
  ReleaseRef,
  View,
  ViewCounts,
} from "@/lib/api/types"

const PAGE_SIZE = 50

export const releaseKeys = {
  all: ["releases"] as const,
  lists: () => [...releaseKeys.all, "list"] as const,
  list: (view: View, search: string) => [...releaseKeys.lists(), view, search] as const,
  counts: (search: string) => [...releaseKeys.all, "counts", search] as const,
  detail: (id: number) => [...releaseKeys.all, "detail", id] as const,
  history: (repositoryId: number) => [...releaseKeys.all, "history", repositoryId] as const,
}

export const readmeKeys = {
  detail: (repositoryId: number) => ["readme", repositoryId] as const,
}

export function useReleaseList(view: View, search: string) {
  return useInfiniteQuery({
    queryKey: releaseKeys.list(view, search),
    queryFn: ({ pageParam, signal }) =>
      api.get<ReleasePage>("/releases", {
        query: { view, q: search, limit: PAGE_SIZE, offset: pageParam },
        signal,
      }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, pages) => {
      const loaded = pages.reduce((sum, page) => sum + page.items.length, 0)
      return loaded < lastPage.total ? loaded : undefined
    },
    placeholderData: keepPreviousData,
  })
}

export function useViewCounts(search: string) {
  return useQuery({
    queryKey: releaseKeys.counts(search),
    queryFn: ({ signal }) =>
      api.get<ViewCounts>("/releases/counts", { query: { q: search }, signal }),
    placeholderData: keepPreviousData,
  })
}

export function useRelease(id: number | null) {
  return useQuery({
    queryKey: releaseKeys.detail(id ?? 0),
    queryFn: ({ signal }) => api.get<ReleaseDetail>(`/releases/${id}`, { signal }),
    enabled: id !== null,
  })
}

export function useReleaseHistory(repositoryId: number | undefined) {
  return useQuery({
    queryKey: releaseKeys.history(repositoryId ?? 0),
    queryFn: ({ signal }) =>
      api.get<ReleaseRef[]>(`/repositories/${repositoryId}/releases`, { signal }),
    enabled: repositoryId !== undefined,
  })
}

export function useReadme(repositoryId: number | undefined, enabled: boolean) {
  return useQuery({
    queryKey: readmeKeys.detail(repositoryId ?? 0),
    queryFn: ({ signal }) => api.get<Readme>(`/repositories/${repositoryId}/readme`, { signal }),
    enabled: enabled && repositoryId !== undefined,
    staleTime: 10 * 60_000,
    retry: false,
  })
}

/** Optimistically drop a repository's entry from the cached lists of a view. */
function removeFromList(queryClient: QueryClient, view: View, repositoryId: number) {
  queryClient.setQueriesData<InfiniteData<ReleasePage>>(
    { queryKey: [...releaseKeys.lists(), view] },
    (data) =>
      data && {
        ...data,
        pages: data.pages.map((page) => {
          const items = page.items.filter((item) => item.repository.id !== repositoryId)
          return { items, total: page.total - (page.items.length - items.length) }
        }),
      }
  )
}

interface ReleaseActionInput {
  releaseId: number
  repositoryId: number
}

/** Local only: GitHub has no API to mark a notification unread. */
export function useMarkUnread() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ releaseId }: ReleaseActionInput) => api.post(`/releases/${releaseId}/unread`),
    onMutate: async ({ repositoryId }) => {
      await queryClient.cancelQueries({ queryKey: releaseKeys.lists() })
      removeFromList(queryClient, "read", repositoryId)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: releaseKeys.all }),
  })
}
