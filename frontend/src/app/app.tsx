import { QueryClientProvider } from "@tanstack/react-query"
import { lazy, Suspense } from "react"
import { BrowserRouter, Navigate, Route, Routes, useParams } from "react-router"

import { ErrorBoundary } from "@/components/error-boundary"
import { ErrorState } from "@/components/error-state"
import { Toaster } from "@/components/ui/sonner"
import { Spinner } from "@/components/ui/spinner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { useCurrentUser } from "@/features/auth/api"
import { useLiveUpdates } from "@/features/live-updates/use-live-updates"
import { useNotificationNavigation } from "@/features/notifications/use-notification-navigation"
import { DeferredActionsProvider } from "@/features/releases/deferred-actions/provider"
import { InboxPage } from "@/features/releases/inbox-page"
import { ThemeProvider } from "@/features/theme/provider"
import { isView } from "@/lib/api/types"

import { queryClient } from "./query-client"

// Most visits are signed in already, so the sign-in page loads only when needed.
const LoginPage = lazy(() =>
  import("@/features/auth/login-page").then((module) => ({ default: module.LoginPage }))
)

export function App() {
  return (
    <ErrorBoundary
      fallback={() => (
        <ErrorState
          className="h-dvh"
          title="Something went wrong"
          description="The app ran into an unexpected error."
          actionLabel="Reload"
          onAction={() => window.location.reload()}
        />
      )}
    >
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <TooltipProvider delayDuration={300}>
            <DeferredActionsProvider>
              <BrowserRouter>
                <AuthenticatedApp />
              </BrowserRouter>
            </DeferredActionsProvider>
            <Toaster position="bottom-center" />
          </TooltipProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}

function AuthenticatedApp() {
  const me = useCurrentUser()
  const user = me.data
  useLiveUpdates(Boolean(user))
  useNotificationNavigation()

  if (me.isPending) return <FullPageSpinner />
  if (me.isError) {
    return (
      <ErrorState
        className="h-dvh"
        title="The server isn't responding"
        description="It may be restarting. Try again in a moment."
        onAction={() => void me.refetch()}
      />
    )
  }
  if (!user) {
    return (
      <Suspense fallback={<FullPageSpinner />}>
        <LoginPage />
      </Suspense>
    )
  }

  return (
    <Routes>
      <Route path="/:view" element={<ViewRoute username={user.username} />} />
      <Route path="*" element={<Navigate to="/inbox" replace />} />
    </Routes>
  )
}

function FullPageSpinner() {
  return (
    <div className="flex h-dvh items-center justify-center">
      <Spinner className="size-6 text-muted-foreground" />
    </div>
  )
}

function ViewRoute({ username }: { username: string }) {
  const { view } = useParams()
  if (!isView(view)) return <Navigate to="/inbox" replace />
  return <InboxPage username={username} />
}
