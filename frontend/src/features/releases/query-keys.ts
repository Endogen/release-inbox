import type { View } from "@/lib/api/types"

export const releaseKeys = {
  all: ["releases"] as const,
  lists: () => [...releaseKeys.all, "list"] as const,
  viewLists: (view: View) => [...releaseKeys.lists(), view] as const,
  list: (view: View, search: string) => [...releaseKeys.viewLists(view), search] as const,
  counts: (search: string) => [...releaseKeys.all, "counts", search] as const,
  details: () => [...releaseKeys.all, "detail"] as const,
  detail: (id: number) => [...releaseKeys.details(), id] as const,
  history: (repositoryId: number) => [...releaseKeys.all, "history", repositoryId] as const,
  unread: (repositoryId: number) => [...releaseKeys.all, "unread", repositoryId] as const,
}

export const readmeKeys = {
  detail: (repositoryId: number) => ["readme", repositoryId] as const,
}
