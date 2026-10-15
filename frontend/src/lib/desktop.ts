/**
 * The bridge to the desktop app, which shows this web app in a native window. There the
 * desktop shows notifications and the inbox count in the tray instead of the browser, and
 * the tray's menu and clicked notifications ask the web app to act.
 */
import { invoke, isTauri } from "@tauri-apps/api/core"
import { listen } from "@tauri-apps/api/event"

/** Whether the app runs inside the desktop app. */
export function isDesktop(): boolean {
  return isTauri()
}

/** A ``notification`` event of the server's event stream. */
export interface DesktopNotification {
  title: string
  body: string
  /** Where it leads inside the app, e.g. ``/inbox?release=1``. */
  url: string
  tag: string
  unread: number | null
  release_ids: number[]
  repository_id: number | null
}

/** Reads a ``notification`` event; ``undefined`` if malformed. */
export function readDesktopNotification(data: string): DesktopNotification | undefined {
  try {
    const payload: unknown = JSON.parse(data)
    if (
      payload &&
      typeof payload === "object" &&
      "title" in payload &&
      typeof payload.title === "string" &&
      "body" in payload &&
      typeof payload.body === "string" &&
      "url" in payload &&
      typeof payload.url === "string"
    ) {
      return payload as DesktopNotification
    }
  } catch {
    // Not JSON; ignore it like any other unknown message.
  }
  return undefined
}

export function showDesktopNotification(notification: DesktopNotification): Promise<void> {
  return invoke("show_notification", { notification })
}

export function setDesktopUnreadCount(count: number): Promise<void> {
  return invoke("set_unread_count", { count })
}

/** A button clicked on a notification about releases. */
export interface DesktopAction {
  action: "mark-read" | "snooze" | "mute"
  release_ids: number[]
  /** Set if all of them belong to one repository; muting needs it. */
  repository_id: number | null
  /** The notification's title, such as the repository's name. */
  title: string | null
}

type DesktopEvents = {
  /** The tray's "Sync now". */
  "desktop://sync": null
  /** A clicked notification: the path inside the app it leads to. */
  "desktop://navigate": string
  "desktop://action": DesktopAction
}

/** Calls ``handler`` for every ``event`` from the desktop; returns a function that stops. */
export function onDesktopEvent<E extends keyof DesktopEvents>(
  event: E,
  handler: (payload: DesktopEvents[E]) => void
): () => void {
  let stopped = false
  let unlisten: (() => void) | undefined
  void listen<DesktopEvents[E]>(event, ({ payload }) => handler(payload)).then((stop) => {
    if (stopped) stop()
    else unlisten = stop
  })
  return () => {
    stopped = true
    unlisten?.()
  }
}
