import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { releaseKeys } from "@/features/releases/query-keys"
import { api } from "@/lib/api/client"
import type { Preferences } from "@/lib/api/types"

const preferenceKeys = {
  all: ["preferences"] as const,
}

export function usePreferences() {
  return useQuery({
    queryKey: preferenceKeys.all,
    queryFn: ({ signal }) => api.get<Preferences>("/preferences", { signal }),
    staleTime: Infinity,
  })
}

/**
 * Changes some preferences, showing them right away. The saved preferences are loaded once no
 * change is in flight, so quick changes to several settings don't undo each other.
 */
export function useUpdatePreferences() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationKey: preferenceKeys.all,
    mutationFn: (changes: Partial<Preferences>) => api.patch<Preferences>("/preferences", changes),
    meta: { errorMessage: "Couldn't save the setting" },
    onMutate: async (changes) => {
      await queryClient.cancelQueries({ queryKey: preferenceKeys.all })
      queryClient.setQueryData<Preferences>(
        preferenceKeys.all,
        (current) => current && { ...current, ...changes }
      )
    },
    onSettled: async (_preferences, _error, changes) => {
      // Pre-releases move between the views; the other settings don't change the lists.
      if ("prereleases" in changes)
        await queryClient.invalidateQueries({ queryKey: releaseKeys.all })
      if (queryClient.isMutating({ mutationKey: preferenceKeys.all }) === 1) {
        await queryClient.invalidateQueries({ queryKey: preferenceKeys.all })
      }
    },
  })
}
