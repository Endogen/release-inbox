import { useEffect } from "react"
import { useNavigate } from "react-router"

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

/** Opens the release a clicked push notification points to inside the running app. */
export function useNotificationNavigation(): void {
  const navigate = useNavigate()

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return

    function onMessage(event: MessageEvent) {
      if (isNavigateMessage(event.data)) navigate(event.data.url)
    }

    navigator.serviceWorker.addEventListener("message", onMessage)
    return () => navigator.serviceWorker.removeEventListener("message", onMessage)
  }, [navigate])
}
