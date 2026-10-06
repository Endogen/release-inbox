import { useMutation, useQuery } from "@tanstack/react-query"

import { api } from "@/lib/api/client"
import type { Summary, SummaryConfig } from "@/lib/api/types"

export function useSummaryConfig() {
  return useQuery({
    queryKey: ["summaries", "config"],
    queryFn: ({ signal }) => api.get<SummaryConfig>("/summaries/config", { signal }),
    staleTime: Infinity,
  })
}

/** Summaries are generated on request (they cost money) and cached on the server. */
export function useSummarize() {
  return useMutation({
    mutationFn: (releaseIds: number[]) =>
      api.post<Summary>("/summaries", { release_ids: releaseIds }),
  })
}
