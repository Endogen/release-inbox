import { useEffect } from "react"
import { useNavigate } from "react-router"

import { useStableCallback } from "@/hooks/use-stable-callback"
import { isDesktop, onDesktopEvent } from "@/lib/desktop"

interface NavigateMessage {
  type: "navigate"
  url: string
}

function isNavigateMessage(data: unknown): data is NavigateMessage {
  return (
    typeof data === "object" &&
    data !== null &&
    (data as NavigateMessage).type === "navigate" &&
    typeof (data as NavigateMessage).url === "string"
  )
}

/** Opens the release a clicked notification points to inside the running app. */
export function useNotificationNavigation(): void {
  const navigate = useNavigate()
  // Stable, so changing routes doesn't unsubscribe and miss a click in between.
  const open = useStableCallback((url: string) => void navigate(url))

  useEffect(() => {
    if (isDesktop()) return onDesktopEvent("desktop://navigate", open)
    if (!("serviceWorker" in navigator)) return

    function onMessage(event: MessageEvent) {
      if (isNavigateMessage(event.data)) open(event.data.url)
    }

    navigator.serviceWorker.addEventListener("message", onMessage)
    return () => navigator.serviceWorker.removeEventListener("message", onMessage)
  }, [open])
}
