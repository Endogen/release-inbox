import { useEffect, useRef } from "react"

import type { Release } from "@/lib/api/types"

import { viewOf } from "./release-view"

interface Options {
  enabled: boolean
  /** Marks the release's entry as read. */
  markRead: (release: Release) => void
}

/**
 * Marks an unread inbox release as read once the user moves on to another repository or closes
 * it. Returns ``skip``: call it when an action moves the selection off the release (snoozing it,
 * for example), which isn't moving on from it.
 */
export function useMarkReadAfterViewing(
  selected: Release | undefined,
  { enabled, markRead }: Options
) {
  const shown = useRef<Release | undefined>(undefined)
  const skipped = useRef(false)

  // Runs after every render, so ``shown`` has the release's latest state.
  useEffect(() => {
    const left = shown.current
    shown.current = selected
    // Switching versions of the same repository stays on its entry.
    if (!left || left.repository.id === selected?.repository.id) return
    if (skipped.current) {
      skipped.current = false
      return
    }
    if (enabled && left.read_at === null && viewOf(left, Date.now()) === "inbox") markRead(left)
  })

  return function skip() {
    skipped.current = true
  }
}
