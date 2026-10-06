import { useCallback } from "react"

import { useLatest } from "./use-latest"

/**
 * A callback with a stable identity that always calls the latest ``callback``. Lets memoized
 * children and effects receive handlers without re-running whenever the parent renders.
 */
export function useStableCallback<Args extends unknown[], Result>(
  callback: (...args: Args) => Result
): (...args: Args) => Result {
  const latest = useLatest(callback)
  return useCallback((...args: Args) => latest.current(...args), [latest])
}
