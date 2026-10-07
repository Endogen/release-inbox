import { useMemo } from "react"

import type { ReleaseListItem, View } from "@/lib/api/types"

import { useReleaseList, useViewCounts } from "./api"
import { useDeferredActions } from "./deferred-actions/context"
import { hiddenRepositories } from "./deferred-actions/queue"

/**
 * The entries of a view as the list shows them: one per repository, without those an action
 * waiting for its undo window takes out of the view. The counts leave them out too.
 */
export function useInboxEntries(view: View, search: string) {
  const list = useReleaseList(view, search)
  const counts = useViewCounts(search)
  const { pending } = useDeferredActions()

  // Offset pages can overlap when new releases arrive between loads; keep one entry each.
  const loaded = useMemo(() => {
    const byRepository = new Map<number, ReleaseListItem>()
    for (const item of list.data?.pages.flatMap((page) => page.items) ?? []) {
      if (!byRepository.has(item.repository.id)) byRepository.set(item.repository.id, item)
    }
    return byRepository
  }, [list.data])
  const hidden = useMemo(() => hiddenRepositories(pending, view), [pending, view])
  const items = useMemo(
    () => [...loaded.values()].filter((item) => !hidden.has(item.repository.id)),
    [loaded, hidden]
  )
  const viewCounts = counts.data && {
    ...counts.data,
    [view]: Math.max(0, counts.data[view] - (loaded.size - items.length)),
  }

  return {
    list,
    /** Every loaded entry by repository, including hidden ones. */
    loaded,
    items,
    viewCounts,
  }
}
