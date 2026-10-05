import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query"

import { authKeys } from "@/features/auth/api"
import { ApiError } from "@/lib/api/client"

/** An expired session anywhere in the app sends the user back to the sign-in screen. */
function handleUnauthorized(error: Error) {
  if (error instanceof ApiError && error.isUnauthorized) {
    queryClient.setQueryData(authKeys.me, null)
  }
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: handleUnauthorized }),
  mutationCache: new MutationCache({ onError: handleUnauthorized }),
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: true,
      retry: (failureCount, error) =>
        !(error instanceof ApiError && error.status < 500) && failureCount < 2,
    },
  },
})
