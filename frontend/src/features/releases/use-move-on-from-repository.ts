import { useEffect, useRef } from "react"

import type { Release } from "@/lib/api/types"

interface Options {
  enabled: boolean
  /** Called with the last release shown of the repository the user moved on from. */
  onMoveOn: (release: Release) => void
}

/**
 * Notices when the user moves on from a repository: selects another one or closes the release.
 * Returns ``skip``: call it when an action moves the selection off the release (snoozing it,
 * for example), which isn't moving on from it.
 */
export function useMoveOnFromRepository(
  selected: Release | undefined,
  { enabled, onMoveOn }: Options
) {
  const shown = useRef<Release | undefined>(undefined)
  const skipped = useRef(false)

  // Runs after every render, so ``shown`` has the release's latest state.
  useEffect(() => {
    const left = shown.current
    shown.current = selected
    // Switching versions of the same repository stays on it.
    if (!left || left.repository.id === selected?.repository.id) return
    if (skipped.current) {
      skipped.current = false
      return
    }
    if (enabled) onMoveOn(left)
  })

  return function skip() {
    skipped.current = true
  }
}
