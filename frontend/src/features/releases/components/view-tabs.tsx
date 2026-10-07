import { cn } from "cn"
import { Link } from "react-router"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { VIEWS, type View, type ViewCounts } from "@/lib/api/types"

import { viewPath } from "../use-inbox-route"
import { VIEW_META } from "../view-meta"

interface ViewTabsProps {
  view: View
  counts: ViewCounts | undefined
  /** The search, kept when switching views. */
  search: string
}

/** The views are pages of the app, so they are links (with ``aria-current``), not ARIA tabs. */
export function ViewTabs({ view, counts, search }: ViewTabsProps) {
  return (
    <nav aria-label="Views" className="@container flex gap-1">
      {VIEWS.map((item) => {
        const { label, icon: Icon } = VIEW_META[item]
        const active = item === view
        const count = counts?.[item] ?? 0
        return (
          <Button
            key={item}
            asChild
            size="sm"
            variant={active ? "secondary" : "ghost"}
            className="h-8 flex-1 @max-xs:px-1.5"
          >
            <Link to={viewPath(item, search)} aria-current={active ? "page" : undefined}>
              {/* A narrow list needs the room for the labels and counts. */}
              <Icon data-icon="inline-start" className="hidden @md:block" />
              {label}
              {count > 0 && (
                <Badge
                  variant={item === "inbox" ? "default" : "outline"}
                  // On the narrowest screens only the inbox count fits next to the four labels.
                  className={cn("tabular-nums", item !== "inbox" && "@max-xs:hidden")}
                >
                  {count}
                </Badge>
              )}
            </Link>
          </Button>
        )
      })}
    </nav>
  )
}
