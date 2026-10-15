import { useEffect } from "react"

import { useStableCallback } from "@/hooks/use-stable-callback"
import { isDesktop, onDesktopEvent } from "@/lib/desktop"

import { useNotificationActions } from "./use-notification-actions"

/** Runs the buttons on the desktop app's release notifications; renders nothing. */
export function DesktopNotificationActions() {
  return isDesktop() ? <NotificationActions /> : null
}

function NotificationActions() {
  const run = useStableCallback(useNotificationActions())
  useEffect(() => onDesktopEvent("desktop://action", run), [run])
  return null
}
