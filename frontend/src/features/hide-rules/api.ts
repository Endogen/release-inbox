import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { releaseKeys } from "@/features/releases/api"
import { api } from "@/lib/api/client"
import type { HideRule, HideRulePreview } from "@/lib/api/types"

export const hideRuleKeys = {
  all: ["hide-rules"] as const,
  list: () => [...hideRuleKeys.all, "list"] as const,
  preview: (repositoryId: number, pattern: string) =>
    [...hideRuleKeys.all, "preview", repositoryId, pattern] as const,
}

export function useHideRules() {
  return useQuery({
    queryKey: hideRuleKeys.list(),
    queryFn: ({ signal }) => api.get<HideRule[]>("/hide-rules", { signal }),
  })
}

export function useHideRulePreview(repositoryId: number, pattern: string) {
  return useQuery({
    queryKey: hideRuleKeys.preview(repositoryId, pattern),
    queryFn: ({ signal }) =>
      api.get<HideRulePreview>("/hide-rules/preview", {
        query: { repository_id: repositoryId, pattern },
        signal,
      }),
    enabled: pattern.length > 0,
    placeholderData: keepPreviousData,
  })
}

function useInvalidateAfterRuleChange() {
  const queryClient = useQueryClient()
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: hideRuleKeys.all }),
      queryClient.invalidateQueries({ queryKey: releaseKeys.all }),
    ])
}

export function useCreateHideRule() {
  const invalidate = useInvalidateAfterRuleChange()
  return useMutation({
    mutationFn: (input: { repositoryId: number; pattern: string }) =>
      api.post<HideRule>("/hide-rules", {
        repository_id: input.repositoryId,
        pattern: input.pattern,
      }),
    onSettled: invalidate,
  })
}

export function useDeleteHideRule() {
  const invalidate = useInvalidateAfterRuleChange()
  return useMutation({
    mutationFn: (ruleId: number) => api.delete(`/hide-rules/${ruleId}`),
    onSettled: invalidate,
  })
}
