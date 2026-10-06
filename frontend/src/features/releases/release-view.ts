import type { Release, View } from "@/lib/api/types"

/** The view a release is listed in. Like on the server, hidden takes precedence. */
export function viewOf(release: Release, now: number): View {
  if (release.is_hidden) return "hidden"
  if (release.read_at !== null) return "read"
  if (release.snoozed_until !== null && new Date(release.snoozed_until).getTime() > now) {
    return "snoozed"
  }
  return "inbox"
}

/** Snoozing is for unread releases that aren't hidden. */
export function canSnooze(release: Release, now: number): boolean {
  const view = viewOf(release, now)
  return view === "inbox" || view === "snoozed"
}

/** The view a release moves to when its read or snooze state changes; hidden ones stay. */
export function destinationOf(release: Release, to: Exclude<View, "hidden">): View {
  return release.is_hidden ? "hidden" : to
}
