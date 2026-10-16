import { useEffect } from "react"

import { isDesktop, setDesktopStatus, type DesktopStatus } from "@/lib/desktop"

/**
 * Tells the desktop app whether it gets notifications; ``undefined`` (still loading) tells
 * nothing. The desktop counts a page that doesn't report as not connected.
 */
export function useDesktopStatus(status: DesktopStatus | undefined): void {
  useEffect(() => {
    if (status !== undefined && isDesktop()) void setDesktopStatus(status)
  }, [status])
}

/**
 * The status for what the page shows: the user's session is still loading (``pending``),
 * couldn't be checked (``error``) or is ``signedIn``; ``live`` is the state of the event
 * stream that carries the notifications.
 */
export function desktopStatus(
  pending: boolean,
  error: boolean,
  signedIn: boolean,
  live: boolean | undefined
): DesktopStatus | undefined {
  if (pending) return undefined
  if (error) return "disconnected"
  if (!signedIn) return "signed-out"
  if (live === undefined) return undefined
  return live ? "connected" : "disconnected"
}
