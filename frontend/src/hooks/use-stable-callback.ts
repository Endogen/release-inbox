import { useCallback, useLayoutEffect, useRef } from "react"

/**
 * A callback with a stable identity that always calls the latest ``callback``. Lets memoized
 * children receive event handlers without re-rendering whenever the parent does.
 */
export function useStableCallback<Args extends unknown[], Result>(
  callback: (...args: Args) => Result
): (...args: Args) => Result {
  const latest = useRef(callback)
  useLayoutEffect(() => {
    latest.current = callback
  })
  return useCallback((...args: Args) => latest.current(...args), [])
}
