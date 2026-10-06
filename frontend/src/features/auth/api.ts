import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { useDeferredActionQueue } from "@/features/deferred-actions/context"
import { api, ApiError } from "@/lib/api/client"
import type { CurrentUser } from "@/lib/api/types"

export const authKeys = {
  me: ["auth", "me"] as const,
}

/** The signed-in user, or `null` when there is no valid session. */
export function useCurrentUser() {
  return useQuery({
    queryKey: authKeys.me,
    queryFn: async ({ signal }) => {
      try {
        return await api.get<CurrentUser>("/auth/me", { signal })
      } catch (error) {
        if (error instanceof ApiError && error.isUnauthorized) return null
        throw error
      }
    },
    staleTime: Infinity,
  })
}

export function useLogin() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (credentials: { username: string; password: string }) =>
      api.post<CurrentUser>("/auth/login", credentials),
    onSuccess: (user) => queryClient.setQueryData(authKeys.me, user),
  })
}

export function useLogout() {
  const queryClient = useQueryClient()
  const pendingActions = useDeferredActionQueue()
  return useMutation({
    mutationFn: async () => {
      // Send undoable actions that are still waiting while the session is valid.
      await pendingActions.flush()
      await api.post("/auth/logout")
    },
    onSuccess: () => {
      queryClient.clear()
      queryClient.setQueryData(authKeys.me, null)
    },
  })
}
