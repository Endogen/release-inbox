import { createContext, useContext, useSyncExternalStore } from "react"

import type { DeferredActionQueue } from "./queue"

export const DeferredActionsContext = createContext<DeferredActionQueue | null>(null)

export function useDeferredActionQueue(): DeferredActionQueue {
  const queue = useContext(DeferredActionsContext)
  if (!queue) throw new Error("useDeferredActionQueue must be used inside DeferredActionsProvider")
  return queue
}

/** The queue and its pending actions, re-rendering when they change. */
export function useDeferredActions() {
  const queue = useDeferredActionQueue()
  const pending = useSyncExternalStore(queue.subscribe, queue.getSnapshot)
  return { queue, pending }
}
