import type { Release, ReleaseRef } from "@/lib/api/types"

/** "owner/repo · title", e.g. as the description of a toast about the release. */
export function releaseLabel(release: Release): string {
  return `${release.repository.full_name} · ${releaseTitle(release)}`
}

/** The display title of a release: its name, or the tag when it has no name. */
export function releaseTitle(release: Pick<Release | ReleaseRef, "name" | "tag_name">): string {
  return release.name?.trim() || release.tag_name
}
