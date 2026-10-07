import { useEffect } from "react"

/**
 * Shows ``count`` on the icon of the installed app; 0 removes it, ``undefined`` (not known yet)
 * leaves it as it is. Removes it when the component unmounts, e.g. on signing out.
 */
export function useAppBadge(count: number | undefined): void {
  useEffect(() => {
    if (count !== undefined) setAppBadge(count)
  }, [count])
  useEffect(() => () => setAppBadge(0), [])
}

function setAppBadge(count: number): void {
  if (!("setAppBadge" in navigator)) return
  const update = count > 0 ? navigator.setAppBadge(count) : navigator.clearAppBadge()
  // Browsers refuse where the app isn't installed or may not show badges. The badge is an
  // extra, so that isn't an error.
  update.catch(() => undefined)
}
