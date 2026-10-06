import { QueryClientProvider } from "@tanstack/react-query"
import { BrowserRouter, Navigate, Route, Routes } from "react-router"

import { ThemeProvider } from "@/components/theme-provider"
import { Spinner } from "@/components/ui/spinner"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { useCurrentUser } from "@/features/auth/api"
import { DeferredActionsProvider } from "@/features/deferred-actions/provider"
import { LoginPage } from "@/features/auth/login-page"
import { useLiveUpdates } from "@/features/live-updates/use-live-updates"
import { useNotificationNavigation } from "@/features/notifications/use-notification-navigation"
import { InboxPage } from "@/features/releases/inbox-page"

import { queryClient } from "./query-client"

export function App() {
  return (
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
  )
}

function AuthenticatedApp() {
  const { data: user, isPending } = useCurrentUser()
  const signedIn = Boolean(user)
  useLiveUpdates(signedIn)
  useNotificationNavigation()

  if (isPending) {
    return (
      <div className="flex h-dvh items-center justify-center">
        <Spinner className="size-6 text-muted-foreground" />
      </div>
    )
  }

  if (!user) return <LoginPage />

  return (
    <Routes>
      <Route path="/:view" element={<InboxPage username={user.username} />} />
      <Route path="*" element={<Navigate to="/inbox" replace />} />
    </Routes>
  )
}
