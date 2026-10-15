/** Readers for the data of the server's live-update events; ``undefined`` if malformed. */
import type { DesktopNotification } from "@/lib/desktop"

function readObject(data: string): Record<string, unknown> | undefined {
  try {
    const payload: unknown = JSON.parse(data)
    if (payload && typeof payload === "object" && !Array.isArray(payload)) {
      return payload as Record<string, unknown>
    }
  } catch {
    // Not JSON; ignore the event like any other unknown message.
  }
  return undefined
}

/** The ``in_progress`` flag of a ``sync-status`` event. */
export function readInProgress(data: string): boolean | undefined {
  const inProgress = readObject(data)?.in_progress
  return typeof inProgress === "boolean" ? inProgress : undefined
}

/** A ``notification`` event, which only the desktop app subscribes to. */
export function readNotification(data: string): DesktopNotification | undefined {
  const payload = readObject(data)
  if (!payload) return undefined
  const {
    title,
    body,
    url,
    release_ids: releaseIds = [],
    repository_id: repositoryId = null,
  } = payload
  if (typeof title !== "string" || typeof body !== "string" || typeof url !== "string") {
    return undefined
  }
  if (!Array.isArray(releaseIds) || !releaseIds.every((id) => typeof id === "number")) {
    return undefined
  }
  if (repositoryId !== null && typeof repositoryId !== "number") return undefined
  return { title, body, url, release_ids: releaseIds, repository_id: repositoryId }
}
