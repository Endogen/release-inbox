import { Link } from "react-router"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { VIEWS, type View, type ViewCounts } from "@/lib/api/types"
import { cn } from "@/lib/utils"

import { VIEW_META } from "../view-meta"

interface ViewTabsProps {
  view: View
  counts: ViewCounts | undefined
  /** Query string to keep when switching views (the search). */
  search: string
}

/** The views are pages of the app, so they are links (with ``aria-current``), not ARIA tabs. */
export function ViewTabs({ view, counts, search }: ViewTabsProps) {
  const query = search ? `?${new URLSearchParams({ q: search })}` : ""
  return (
    <nav aria-label="Views" className="grid grid-cols-4 gap-1 rounded-lg bg-muted p-[3px]">
      {VIEWS.map((item) => {
        const { label, icon: Icon } = VIEW_META[item]
        const active = item === view
        const count = counts?.[item]
        return (
          <Button
            key={item}
            asChild
            size="sm"
            variant="ghost"
            className={cn(
              "h-7 min-w-0 gap-1.5 px-1.5 text-muted-foreground hover:bg-background/60",
              active && "bg-background text-foreground shadow-sm hover:bg-background"
            )}
          >
            <Link to={`/${item}${query}`} aria-current={active ? "page" : undefined}>
              <Icon data-icon="inline-start" />
              <span className="truncate">{label}</span>
              {count !== undefined && count > 0 && (
                <Badge
                  variant={item === "inbox" ? "default" : "secondary"}
                  className="hidden tabular-nums sm:inline-flex"
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
