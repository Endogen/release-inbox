import { useSetRepositoryNotifications } from "@/features/repositories/api"
import { showDesktopNotification, type DesktopAction } from "@/lib/desktop"
import { plural } from "@/lib/plural"
import { formatAbsolute } from "@/lib/time"
import { toastWithUndo } from "@/lib/toasts"

import { useMarkRead, useMarkUnread, useSnooze, useUnsnooze } from "./api"
import { snoozeOptions } from "./snooze-times"

/**
 * The buttons act on exactly the releases the notification is about. The app is usually in the
 * tray then, so they apply right away instead of waiting for an undo window; the toast still
 * offers to take them back. A failure also gets a notification while the app isn't in front.
 */
export function useNotificationActions(): (action: DesktopAction) => void {
  const markRead = useMarkRead()
  const markUnread = useMarkUnread()
  const snooze = useSnooze()
  const unsnooze = useUnsnooze()
  const setNotifications = useSetRepositoryNotifications()

  return ({ action, release_ids: releaseIds, repository_id: repositoryId, title }) => {
    const description = title ?? undefined
    // Other devices may have changed the lists too: they are refetched, not edited.
    const release = (releaseId: number) => ({
      releaseId,
      repositoryId: repositoryId ?? undefined,
      leaves: null,
    })
    const releases = (count: number) => (count === 1 ? "" : ` ${plural(count, "release")}`)

    switch (action) {
      case "mark-read":
        void forEach(
          releaseIds,
          (id) => markRead.mutateAsync(release(id)),
          "Couldn't mark as read"
        ).then((done) => {
          if (done.length === 0) return
          toastWithUndo(`Marked${releases(done.length)} as read`, {
            description,
            onUndo: () => done.forEach((id) => markUnread.mutate(release(id))),
          })
        })
        return
      case "snooze": {
        const until = tomorrow()
        void forEach(
          releaseIds,
          (id) => snooze.mutateAsync({ ...release(id), until, view: "inbox", search: "" }),
          "Couldn't snooze"
        ).then((done) => {
          if (done.length === 0) return
          toastWithUndo(`Snoozed${releases(done.length)} until ${formatAbsolute(until)}`, {
            description,
            onUndo: () => done.forEach((id) => unsnooze.mutate(release(id))),
          })
        })
        return
      }
      case "mute":
        if (repositoryId === null) return
        setNotifications.mutateAsync({ repositoryId, enabled: false }).then(
          () =>
            toastWithUndo("Notifications off for this repository", {
              description: "New releases still show up in your inbox, without a notification.",
              onUndo: () => setNotifications.mutate({ repositoryId, enabled: true }),
            }),
          (error: unknown) => notifyFailure("Couldn't change notifications", error)
        )
        return
    }
  }
}

/** The "Tomorrow" of the snooze menu. */
function tomorrow(): Date {
  const option = snoozeOptions(new Date()).find(({ id }) => id === "tomorrow")
  if (!option) throw new Error("The snooze menu always offers tomorrow")
  return option.until
}

/** Runs ``act`` for every release at once; resolves to the releases it succeeded for. */
async function forEach(
  releaseIds: number[],
  act: (releaseId: number) => Promise<unknown>,
  errorMessage: string
): Promise<number[]> {
  const results = await Promise.allSettled(releaseIds.map(act))
  const failure = results.find((result) => result.status === "rejected")
  if (failure) notifyFailure(errorMessage, failure.reason)
  return releaseIds.filter((_, index) => results[index]?.status === "fulfilled")
}

/** The mutation's toast reports the failure; out of sight in the tray, a notification does. */
function notifyFailure(message: string, error: unknown): void {
  if (document.hasFocus()) return
  void showDesktopNotification({
    title: message,
    body: error instanceof Error ? error.message : "Try again in the app.",
    url: "/inbox",
    tag: "action-failed",
    unread: null,
    release_ids: [],
    repository_id: null,
  }).catch(() => undefined)
}
