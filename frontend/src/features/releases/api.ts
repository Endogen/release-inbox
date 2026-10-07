import {
  keepPreviousData,
  partialMatchKey,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"

import { api } from "@/lib/api/client"
import type {
  Readme,
  ReleaseAsset,
  ReleaseDetail,
  ReleasePage,
  ReleaseRef,
  View,
  ViewCounts,
} from "@/lib/api/types"

import { removeFromList } from "./cache"
import { readmeKeys, releaseKeys } from "./query-keys"

const PAGE_SIZE = 50

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
    // Keep the list while the search changes, but don't show another view's entries.
    placeholderData: (previous, previousQuery) =>
      previousQuery && partialMatchKey(previousQuery.queryKey, releaseKeys.viewLists(view))
        ? previous
        : undefined,
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

/** A release. While switching to another one, the previous release stays as placeholder. */
export function useRelease(id: number | null) {
  return useQuery({
    queryKey: releaseKeys.detail(id ?? 0),
    queryFn: ({ signal }) => api.get<ReleaseDetail>(`/releases/${id}`, { signal }),
    enabled: id !== null,
    placeholderData: id === null ? undefined : keepPreviousData,
  })
}

/** Files attached to a release. */
export function useReleaseAssets(releaseId: number) {
  return useQuery({
    queryKey: releaseKeys.assets(releaseId),
    queryFn: ({ signal }) => api.get<ReleaseAsset[]>(`/releases/${releaseId}/assets`, { signal }),
    staleTime: 10 * 60_000,
  })
}

export function useReleaseHistory(repositoryId: number) {
  return useQuery({
    queryKey: releaseKeys.history(repositoryId),
    queryFn: ({ signal }) =>
      api.get<ReleaseRef[]>(`/repositories/${repositoryId}/releases`, { signal }),
  })
}

/**
 * Unread inbox releases of a repository, with notes: what's new since it was last read. With
 * the list's search, these are the entry and its ``+N older``.
 */
export function useUnreadReleases(repositoryId: number, search: string) {
  return useQuery({
    queryKey: releaseKeys.unread(repositoryId, search),
    queryFn: ({ signal }) =>
      api.get<ReleaseDetail[]>(`/repositories/${repositoryId}/unread`, {
        query: { q: search },
        signal,
      }),
  })
}

export function useReadme(repositoryId: number) {
  return useQuery({
    queryKey: readmeKeys.detail(repositoryId),
    queryFn: ({ signal }) => api.get<Readme>(`/repositories/${repositoryId}/readme`, { signal }),
    staleTime: 10 * 60_000,
    retry: false,
  })
}

export interface ReleaseActionInput {
  releaseId: number
  repositoryId: number
  /** The view the repository's entry leaves; it's removed from that list right away. */
  leaves: View | null
}

function useReleaseMutation<Input extends ReleaseActionInput>(
  request: (input: Input) => Promise<void>,
  errorMessage: string
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: request,
    meta: { errorMessage },
    onMutate: async ({ repositoryId, leaves }) => {
      if (leaves === null) return
      await queryClient.cancelQueries({ queryKey: releaseKeys.lists() })
      removeFromList(queryClient, leaves, repositoryId)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: releaseKeys.all }),
  })
}

/** Local only: GitHub has no API to mark a notification unread. */
export function useMarkUnread() {
  return useReleaseMutation(
    ({ releaseId }) => api.post(`/releases/${releaseId}/unread`),
    "Couldn't mark as unread"
  )
}

/**
 * Marks the release as read right away, and its older releases in ``includeOlderIn`` that match
 * ``search``. Marking an entry as read from the UI goes through the undo queue instead.
 */
export function useMarkRead() {
  return useReleaseMutation(
    ({
      releaseId,
      includeOlderIn = null,
      search = "",
    }: ReleaseActionInput & { includeOlderIn?: View | null; search?: string }) =>
      api.post(`/releases/${releaseId}/read`, {
        include_older_in: includeOlderIn,
        search: search || null,
      }),
    "Couldn't mark as read"
  )
}

/** Snoozes the release and its older releases in ``view`` that match ``search``. */
export function useSnooze() {
  return useReleaseMutation(
    ({
      releaseId,
      until,
      view,
      search,
    }: ReleaseActionInput & { until: Date; view: View; search: string }) =>
      api.post(`/releases/${releaseId}/snooze`, {
        until: until.toISOString(),
        view,
        search: search || null,
      }),
    "Couldn't snooze"
  )
}

export function useUnsnooze() {
  return useReleaseMutation(
    ({ releaseId }) => api.delete(`/releases/${releaseId}/snooze`),
    "Couldn't unsnooze"
  )
}
