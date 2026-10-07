import { useQueryClient } from "@tanstack/react-query"
import { useEffect, useState, type ReactNode } from "react"
import { toast } from "sonner"

import { api } from "@/lib/api/client"
import { toastError } from "@/lib/toasts"

import { releaseKeys } from "../query-keys"

import { DeferredActionsContext } from "./context"
import { DeferredActionQueue } from "./queue"

/**
 * Owns the undo queue for the whole app (above the sign-in gate, so signing out can flush it)
 * and connects it to toasts and to the page lifecycle.
 */
export function DeferredActionsProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [queue] = useState(
    () =>
      new DeferredActionQueue({
        commit: async (action, { keepalive }) => {
          await api.post(action.path, action.body, { keepalive })
          // Also after a flush on switching tabs: the entry would otherwise show again.
          await queryClient.invalidateQueries({ queryKey: releaseKeys.all })
        },
        onScheduled: (action, queue) =>
          toast(action.message, {
            id: action.id,
            description: action.description,
            // The queue owns the timing; the toast stays until the action settles.
            duration: Number.POSITIVE_INFINITY,
            action: { label: "Undo", onClick: () => queue.undo(action.id) },
            // Swiping the toast away means "I'm sure": send it right away.
            onDismiss: () => void queue.commit(action.id),
          }),
        onSettled: (action) => toast.dismiss(action.id),
        onError: (action, error) => toastError(action.errorMessage, error),
      })
  )

  useEffect(() => {
    // Mobile browsers may discard a background tab without any further event, and toast
    // timers don't run there, so send pending actions as soon as the page is hidden.
    function onVisibilityChange() {
      if (document.visibilityState === "hidden") void queue.flush({ keepalive: true })
    }
    function onPageHide() {
      void queue.flush({ keepalive: true })
    }
    function onPageShow(event: PageTransitionEvent) {
      // Restored from the back/forward cache: the cached data predates the flushed actions.
      if (event.persisted) void queryClient.invalidateQueries()
    }
    document.addEventListener("visibilitychange", onVisibilityChange)
    window.addEventListener("pagehide", onPageHide)
    window.addEventListener("pageshow", onPageShow)
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange)
      window.removeEventListener("pagehide", onPageHide)
      window.removeEventListener("pageshow", onPageShow)
    }
  }, [queue, queryClient])

  return <DeferredActionsContext value={queue}>{children}</DeferredActionsContext>
}
