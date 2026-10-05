import type { Release, ReleaseRef } from "@/lib/api/types"

/** The display title of a release: its name, or the tag when it has no name. */
export function releaseTitle(release: Pick<Release | ReleaseRef, "name" | "tag_name">): string {
  return release.name?.trim() || release.tag_name
}
