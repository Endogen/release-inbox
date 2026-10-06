import { ZapIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

/** The notes announce breaking changes, or the version is a new major version. */
export function BreakingBadge({ className }: { className?: string }) {
  return (
    <Badge variant="destructive" className={cn("shrink-0", className)}>
      <ZapIcon data-icon="inline-start" />
      Breaking
    </Badge>
  )
}

export function PrereleaseBadge({ className }: { className?: string }) {
  return (
    <Badge variant="outline" className={cn("shrink-0", className)}>
      Pre-release
    </Badge>
  )
}
