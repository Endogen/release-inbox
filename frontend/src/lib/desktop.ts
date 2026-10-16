/**
 * The bridge to the desktop app, which shows this web app in a native window. There the
 * desktop shows notifications and the inbox count in the tray instead of the browser, and
 * the tray's menu and clicked notifications ask the web app to act.
 */
import { invoke, isTauri, type InvokeArgs } from "@tauri-apps/api/core"
import { listen } from "@tauri-apps/api/event"

/** Whether the app runs inside the desktop app. */
export function isDesktop(): boolean {
  return isTauri()
}

/** A notification for the desktop to show. */
export interface DesktopNotification {
  title: string
  body: string
  /** Where it leads inside the app, e.g. ``/inbox?release=1``. */
  url: string
  /** The releases it is about; the desktop adds buttons that act on them. */
  release_ids: number[]
  /** Set if all of them belong to one repository. */
  repository_id: number | null
}

function reportFailure(what: string, error: unknown): void {
  console.warn(`The desktop app couldn't ${what}:`, error)
}

/** Calls the desktop; nothing on the page waits for it, so a failure is only logged. */
async function call(command: string, args: InvokeArgs): Promise<void> {
  try {
    await invoke(command, args)
  } catch (error) {
    reportFailure(command.replaceAll("_", " "), error)
  }
}

export function showDesktopNotification(notification: DesktopNotification): Promise<void> {
  return call("show_notification", { notification })
}

export function setDesktopUnreadCount(count: number): Promise<void> {
  return call("set_unread_count", { count })
}

/**
 * Whether the desktop gets notifications: only while signed in and connected to the event
 * stream. The tray shows it, so the user notices when they stop.
 */
export type DesktopStatus = "connected" | "signed-out" | "disconnected"

export function setDesktopStatus(status: DesktopStatus): Promise<void> {
  return call("set_status", { status })
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
  listen<DesktopEvents[E]>(event, ({ payload }) => handler(payload)).then(
    (stop) => {
      // Stopped before listening started: stop right away.
      if (stopped) stop()
      else unlisten = stop
    },
    (error: unknown) => reportFailure(`listen to ${event}`, error)
  )
  return () => {
    stopped = true
    unlisten?.()
  }
}
