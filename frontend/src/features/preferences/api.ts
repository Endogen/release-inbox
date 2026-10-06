import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { releaseKeys } from "@/features/releases/api"
import { api } from "@/lib/api/client"
import type { Preferences } from "@/lib/api/types"

export const preferenceKeys = {
  all: ["preferences"] as const,
}

export function usePreferences() {
  return useQuery({
    queryKey: preferenceKeys.all,
    queryFn: ({ signal }) => api.get<Preferences>("/preferences", { signal }),
    staleTime: Infinity,
  })
}

export function useUpdatePreferences() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (changes: Partial<Preferences>) => api.patch<Preferences>("/preferences", changes),
    onMutate: async (changes) => {
      await queryClient.cancelQueries({ queryKey: preferenceKeys.all })
      const previous = queryClient.getQueryData<Preferences>(preferenceKeys.all)
      if (previous) queryClient.setQueryData(preferenceKeys.all, { ...previous, ...changes })
      return { previous }
    },
    onError: (_error, _changes, context) =>
      queryClient.setQueryData(preferenceKeys.all, context?.previous),
    onSuccess: (preferences) => queryClient.setQueryData(preferenceKeys.all, preferences),
    onSettled: () => queryClient.invalidateQueries({ queryKey: releaseKeys.all }),
  })
}
