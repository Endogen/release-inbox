import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { authKeys } from "@/features/auth/api"
import { ApiError } from "@/lib/api/client"

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
  if (!(error instanceof ApiError && error.isUnauthorized)) return false
  queryClient.setQueryData(authKeys.me, null)
  return true
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: (error) => void signOutIfUnauthorized(error) }),
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      const message = mutation.meta?.errorMessage
      if (!signOutIfUnauthorized(error) && message)
        toast.error(message, { description: error.message })
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: true,
      retry: (failureCount, error) =>
        !(error instanceof ApiError && error.status < 500) && failureCount < 2,
    },
  },
})
