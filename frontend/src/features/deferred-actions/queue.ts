import type { View } from "@/lib/api/types"

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

export interface CommitOptions {
  /** The page is going away; the request must outlive it. */
  keepalive: boolean
}

export interface QueueCallbacks {
  /** Send the action to the server. Rejections are reported through ``onError``. */
  commit: (action: DeferredAction, options: CommitOptions) => Promise<void>
  /** Receives the queue so it can offer "undo" for the action. */
  onScheduled?: (action: DeferredAction, queue: DeferredActionQueue) => void
  /** The action left the queue: committed, undone or failed. */
  onSettled?: (action: DeferredAction) => void
  onError?: (action: DeferredAction, error: unknown) => void
}

interface Entry {
  action: DeferredAction
  timer: ReturnType<typeof setTimeout> | undefined
}

/**
 * Undoable actions: callers update the UI immediately, but the request is only sent once the
 * undo window has passed (or the page is about to be hidden). Undoing therefore never reaches
 * the server. Implements the ``useSyncExternalStore`` contract.
 */
export class DeferredActionQueue {
  private readonly entries = new Map<string, Entry>()
  private readonly listeners = new Set<() => void>()
  private snapshot: readonly DeferredAction[] = []
  private readonly callbacks: QueueCallbacks
  private readonly undoWindowMs: number

  constructor(callbacks: QueueCallbacks, undoWindowMs = UNDO_WINDOW_MS) {
    this.callbacks = callbacks
    this.undoWindowMs = undoWindowMs
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getSnapshot = (): readonly DeferredAction[] => this.snapshot

  has(id: string): boolean {
    return this.entries.has(id)
  }

  /** Returns false if an action with the same id is already pending. */
  schedule(action: DeferredAction): boolean {
    if (this.entries.has(action.id)) return false
    const timer = setTimeout(() => void this.commit(action.id), this.undoWindowMs)
    this.entries.set(action.id, { action, timer })
    this.emit()
    this.callbacks.onScheduled?.(action, this)
    return true
  }

  /** Cancels a pending action. Returns false if it was already sent. */
  undo(id: string): boolean {
    const entry = this.entries.get(id)
    if (!entry || entry.timer === undefined) return false
    clearTimeout(entry.timer)
    this.remove(entry)
    return true
  }

  /** Sends a pending action now instead of waiting for the undo window to end. */
  commit(id: string, options: CommitOptions = { keepalive: false }): Promise<void> {
    const entry = this.entries.get(id)
    if (!entry || entry.timer === undefined) return Promise.resolve()
    clearTimeout(entry.timer)
    // Stays in the queue (and hidden in the UI) until the server confirmed it.
    entry.timer = undefined
    return this.callbacks.commit(entry.action, options).then(
      () => this.remove(entry),
      (error: unknown) => {
        this.callbacks.onError?.(entry.action, error)
        this.remove(entry)
      }
    )
  }

  /** Sends everything that is still waiting, e.g. before the page is hidden or on sign-out. */
  flush(options: CommitOptions = { keepalive: false }): Promise<void> {
    const pending = [...this.entries.values()].filter((entry) => entry.timer !== undefined)
    return Promise.all(pending.map((entry) => this.commit(entry.action.id, options))).then(
      () => undefined
    )
  }

  private remove(entry: Entry): void {
    if (this.entries.get(entry.action.id) !== entry) return
    this.entries.delete(entry.action.id)
    this.emit()
    this.callbacks.onSettled?.(entry.action)
  }

  private emit(): void {
    this.snapshot = [...this.entries.values()].map((entry) => entry.action)
    this.listeners.forEach((listener) => listener())
  }
}

/** Repositories that a pending action currently hides from ``view``. */
export function hiddenRepositories(
  actions: readonly DeferredAction[],
  view: View
): ReadonlySet<number> {
  return new Set(
    actions.filter((action) => action.hideFrom === view).map((action) => action.repositoryId)
  )
}
