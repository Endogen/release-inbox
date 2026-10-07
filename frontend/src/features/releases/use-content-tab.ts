import { useState } from "react"

import { CONTENT_TABS, useDisplaySettings, type ContentTab } from "@/lib/display-settings"

/**
 * The tab of the release detail: the one chosen while the repository is shown, otherwise the
 * preferred one. "What's new" only exists where an entry has unread older releases.
 */
export function useContentTab(repositoryId: number | undefined, whatsNewCount: number) {
  const { openOn } = useDisplaySettings()
  const [chosen, setChosen] = useState<{ repositoryId: number; tab: ContentTab } | null>(null)
  // A choice lasts while its repository is shown; the next one opens on the preferred tab.
  if (chosen && chosen.repositoryId !== repositoryId) setChosen(null)

  const tabs = CONTENT_TABS.filter((tab) => tab !== "changes" || whatsNewCount > 0)
  const wanted = chosen && chosen.repositoryId === repositoryId ? chosen.tab : openOn
  const tab = tabs.includes(wanted) ? wanted : "notes"

  function choose(next: ContentTab) {
    if (repositoryId !== undefined) setChosen({ repositoryId, tab: next })
  }

  function cycle() {
    choose(tabs[(tabs.indexOf(tab) + 1) % tabs.length] ?? "notes")
  }

  return { tab, choose, cycle }
}
