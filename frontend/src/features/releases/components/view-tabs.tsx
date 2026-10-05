import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { VIEWS, type View, type ViewCounts } from "@/lib/api/types"

import { VIEW_META } from "../view-meta"

interface ViewTabsProps {
  view: View
  counts: ViewCounts | undefined
  onChange: (view: View) => void
}

export function ViewTabs({ view, counts, onChange }: ViewTabsProps) {
  return (
    <Tabs value={view} onValueChange={(value) => onChange(value as View)}>
      <TabsList className="w-full">
        {VIEWS.map((item) => {
          const { label, icon: Icon } = VIEW_META[item]
          const count = counts?.[item]
          return (
            <TabsTrigger key={item} value={item}>
              <Icon data-icon="inline-start" />
              {label}
              {count !== undefined && count > 0 && (
                <Badge variant={item === "inbox" ? "default" : "secondary"} className="tabular-nums">
                  {count}
                </Badge>
              )}
            </TabsTrigger>
          )
        })}
      </TabsList>
    </Tabs>
  )
}
