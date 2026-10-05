import { useQueryClient } from "@tanstack/react-query"
import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import { api } from "@/lib/api/client"
import type { View } from "@/lib/api/types"

import { releaseKeys } from "./api"

/** How long an action can be undone before it is sent to the server. */
export const UNDO_WINDOW_MS = 6000

export interface DeferredAction {
  /** Identifies the action; scheduling the same id again while it is pending is ignored. */
  id: string
  repositoryId: number
  /** View the repository disappears from while the action is pending, if any. */
  hideFrom: View | null
  /** API path the action is committed with (POST). */
  path: string
  message: string
  description?: string
  errorMessage: string
}

interface PendingEntry {
  action: DeferredAction
  settled: boolean
}

/**
 * Undoable actions: the UI updates immediately, but the request is only sent once the undo
 * toast closes. Undoing therefore never touches GitHub. Pending actions are flushed when the
 * page is closed.
 */
export function useDeferredActions() {
  const queryClient = useQueryClient()
  const entries = useRef(new Map<string, PendingEntry>())
  const [pending, setPending] = useState<readonly DeferredAction[]>([])

  const sync = useCallback(() => {
    setPending([...entries.current.values()].map((entry) => entry.action))
  }, [])

  const remove = useCallback(
    (id: string) => {
      entries.current.delete(id)
      sync()
    },
    [sync]
  )

  const commit = useCallback(
    async (action: DeferredAction) => {
      try {
        await api.post(action.path)
        await queryClient.invalidateQueries({ queryKey: releaseKeys.all })
      } catch (error) {
        toast.error(action.errorMessage, {
          description: error instanceof Error ? error.message : undefined,
        })
      } finally {
        // Kept hidden until the refreshed data arrived, so the entry doesn't flash back.
        remove(action.id)
      }
    },
    [queryClient, remove]
  )

  const schedule = useCallback(
    (action: DeferredAction) => {
      if (entries.current.has(action.id)) return
      const entry: PendingEntry = { action, settled: false }
      entries.current.set(action.id, entry)
      sync()

      const settle = (undo: boolean) => {
        if (entry.settled) return
        entry.settled = true
        if (undo) remove(action.id)
        else void commit(action)
      }

      toast(action.message, {
        id: action.id,
        description: action.description,
        duration: UNDO_WINDOW_MS,
        action: { label: "Undo", onClick: () => settle(true) },
        onAutoClose: () => settle(false),
        onDismiss: () => settle(false),
      })
    },
    [commit, remove, sync]
  )

  useEffect(() => {
    function flush() {
      for (const entry of entries.current.values()) {
        if (entry.settled) continue
        entry.settled = true
        void api.post(entry.action.path, undefined, { keepalive: true })
      }
    }
    window.addEventListener("pagehide", flush)
    return () => window.removeEventListener("pagehide", flush)
  }, [])

  const isHidden = useCallback(
    (repositoryId: number, view: View) =>
      pending.some((action) => action.repositoryId === repositoryId && action.hideFrom === view),
    [pending]
  )

  return { pending, schedule, isHidden }
}
