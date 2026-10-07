import { toast } from "sonner"

import { useSetRepositoryNotifications } from "@/features/repositories/api"
import type { Release, ReleaseListItem, Repository, View } from "@/lib/api/types"
import { copyToClipboard } from "@/lib/clipboard"
import { formatAbsolute } from "@/lib/time"
import { toastError, toastWithUndo } from "@/lib/toasts"

import { useMarkRead, useMarkUnread, useSnooze, useUnsnooze } from "./api"
import { useDeferredActions } from "./deferred-actions/context"
import { releaseLabel } from "./release-title"
import { destinationOf, viewOf } from "./release-view"

interface ReleaseActionsOptions {
  /** The view that is shown. */
  view: View
  /** The search the list is filtered by; an entry stands for its matching releases. */
  search: string
  /** The entry a repository has in the shown list, if it is listed. */
  entryOf: (repositoryId: number) => ReleaseListItem | undefined
  /** Called right before a release's entry leaves the shown list, to move the selection. */
  onLeave: (release: Release) => void
}

/**
 * The actions on releases and repositories, with their toasts and undo.
 *
 * An action on an entry covers what the entry stands for: the release and its older releases
 * in the same view. The entry leaves the list if the action moves it to another view.
 */
export function useReleaseActions({ view, search, entryOf, onLeave }: ReleaseActionsOptions) {
  const { queue, pending } = useDeferredActions()
  const markUnreadMutation = useMarkUnread()
  const markReadMutation = useMarkRead()
  const snoozeMutation = useSnooze()
  const unsnoozeMutation = useUnsnooze()
  const setNotifications = useSetRepositoryNotifications()

  /** The view the release's entry leaves when the release moves to ``to``, if any. */
  function leavingView(release: Release, to: Exclude<View, "hidden">): View | null {
    const isEntry = entryOf(release.repository.id)?.id === release.id
    const leaving =
      isEntry && viewOf(release, Date.now()) === view && destinationOf(release, to) !== view
    return leaving ? view : null
  }

  /** Mutation input for moving a release to ``to``; moves the selection off a leaving entry. */
  function moveTo(release: Release, to: Exclude<View, "hidden">) {
    const leaves = leavingView(release, to)
    if (leaves !== null) onLeave(release)
    return { releaseId: release.id, repositoryId: release.repository.id, leaves }
  }

  function markRead(release: Release) {
    queue.schedule({
      id: markReadId(release),
      repositoryId: release.repository.id,
      hideFrom: moveTo(release, "read").leaves,
      path: `/releases/${release.id}/read`,
      body: { include_older_in: viewOf(release, Date.now()), search: search || null },
      message: "Marked as read",
      description: releaseLabel(release),
      errorMessage: "Couldn't mark as read",
    })
  }

  /**
   * The user viewed a repository's release and moved on: marks its entry as read, without a
   * toast, if it is unread in the inbox. Whichever version was shown, the entry is what counts;
   * an action that is waiting for its undo window is left to finish.
   */
  function markViewed(release: Release) {
    const { repository } = release
    const entry = entryOf(repository.id) ?? release
    const waiting = pending.some((action) => action.repositoryId === repository.id)
    if (entry.read_at !== null || viewOf(entry, Date.now()) !== "inbox" || waiting) return
    markReadMutation.mutate({
      releaseId: entry.id,
      repositoryId: repository.id,
      leaves: leavingView(entry, "read"),
      includeOlderIn: "inbox",
      search,
    })
  }

  function unsubscribe(release: Release) {
    const { repository } = release
    queue.schedule({
      id: unsubscribeId(repository),
      repositoryId: repository.id,
      hideFrom: moveTo(release, "read").leaves,
      path: `/repositories/${repository.id}/unsubscribe`,
      message: `Unsubscribed from ${repository.full_name}`,
      description: "You won't get notifications from this repository anymore.",
      errorMessage: `Couldn't unsubscribe from ${repository.full_name}`,
    })
  }

  function markUnread(release: Release) {
    const unread = moveTo(release, "inbox")
    markUnreadMutation.mutate(unread, {
      onSuccess: () =>
        toastWithUndo("Moved back to the inbox", {
          description: releaseLabel(release),
          onUndo: () => markReadMutation.mutate({ ...unread, leaves: null }),
        }),
    })
  }

  function snooze(release: Release, until: Date) {
    const snoozed = {
      ...moveTo(release, "snoozed"),
      until,
      view: viewOf(release, Date.now()),
      search,
    }
    snoozeMutation.mutate(snoozed, {
      onSuccess: () =>
        toastWithUndo(`Snoozed until ${formatAbsolute(until)}`, {
          description: releaseLabel(release),
          onUndo: () => unsnoozeMutation.mutate({ ...snoozed, leaves: null }),
        }),
    })
  }

  function unsnooze(release: Release) {
    unsnoozeMutation.mutate(moveTo(release, "inbox"), {
      onSuccess: () => toast.success("Back in the inbox", { description: releaseLabel(release) }),
    })
  }

  /** Applies right away (it only affects this app); the toast offers to switch it back. */
  function toggleNotifications(release: Release) {
    const { repository } = release
    if (setNotifications.isPending && setNotifications.variables.repositoryId === repository.id) {
      return
    }
    const enabled = repository.notifications_muted_at !== null
    setNotifications.mutate(
      { repositoryId: repository.id, enabled },
      {
        onSuccess: () =>
          toastWithUndo(`Notifications ${enabled ? "on" : "off"} for ${repository.full_name}`, {
            description: enabled
              ? "You'll be notified about new releases."
              : "New releases still show up in your inbox, without a notification.",
            onUndo: () =>
              setNotifications.mutate({ repositoryId: repository.id, enabled: !enabled }),
          }),
      }
    )
  }

  function copyLink(release: Release) {
    copyToClipboard(release.html_url).then(
      () => toast.success("Link copied", { description: releaseLabel(release) }),
      (error: unknown) => toastError("Couldn't copy the link", error)
    )
  }

  /** Whether an action is waiting for its undo window to pass. */
  const isPending = {
    markRead: (release: Release) => pending.some((action) => action.id === markReadId(release)),
    unsubscribe: (repository: Repository) =>
      pending.some((action) => action.id === unsubscribeId(repository)),
  }

  return {
    markRead,
    markViewed,
    markUnread,
    snooze,
    unsnooze,
    unsubscribe,
    toggleNotifications,
    copyLink,
    isPending,
  }
}

const markReadId = (release: Release) => `read-${release.id}`
const unsubscribeId = (repository: Repository) => `unsubscribe-${repository.id}`
