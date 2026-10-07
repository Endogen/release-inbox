import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { api, isNotFound } from "@/lib/api/client"
import type { Summary, SummaryConfig } from "@/lib/api/types"

/** The most releases one summary covers (``MAX_SUMMARIZED_RELEASES`` on the server). */
export const MAX_SUMMARIZED_RELEASES = 20

const summaryKeys = {
  config: ["summaries", "config"] as const,
  summary: (releaseIds: readonly number[]) => ["summaries", releaseIds.join(",")] as const,
}

export function useSummaryConfig() {
  return useQuery({
    queryKey: summaryKeys.config,
    queryFn: ({ signal }) => api.get<SummaryConfig>("/summaries/config", { signal }),
    staleTime: Infinity,
  })
}

/** The summary of these releases if one was created before, else ``null``. */
export function useSummary(releaseIds: readonly number[], enabled: boolean) {
  return useQuery({
    queryKey: summaryKeys.summary(releaseIds),
    queryFn: async ({ signal }) => {
      try {
        return await api.get<Summary>("/summaries", { query: { release_ids: releaseIds }, signal })
      } catch (error) {
        if (isNotFound(error)) return null
        throw error
      }
    },
    enabled,
    staleTime: Infinity,
  })
}

/** Summaries are created on request (they cost money) and cached on the server. */
export function useSummarize(releaseIds: readonly number[]) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api.post<Summary>("/summaries", { release_ids: releaseIds }),
    onSuccess: (summary) => queryClient.setQueryData(summaryKeys.summary(releaseIds), summary),
  })
}
