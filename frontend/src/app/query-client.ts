import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query"

import { authKeys } from "@/features/auth/api"
import { ApiError, isUnauthorized } from "@/lib/api/client"
import { toastError } from "@/lib/toasts"

declare module "@tanstack/react-query" {
  interface Register {
    mutationMeta: {
      /** Shown as a toast when the mutation fails; omit it when the error is shown in place. */
      errorMessage?: string
    }
  }
}

/** An expired session anywhere in the app sends the user back to the sign-in screen. */
function signOutIfUnauthorized(error: Error): boolean {
  if (!isUnauthorized(error)) return false
  queryClient.setQueryData(authKeys.me, null)
  return true
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: (error) => void signOutIfUnauthorized(error) }),
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      const message = mutation.meta?.errorMessage
      if (!signOutIfUnauthorized(error) && message) toastError(message, error)
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (failureCount, error) =>
        !(error instanceof ApiError && error.status < 500) && failureCount < 2,
    },
  },
})
