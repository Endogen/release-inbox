import { cn } from "cn"
import { ZapIcon } from "lucide-react"
import type { ComponentProps } from "react"

import { Badge } from "@/components/ui/badge"

type BadgeProps = Omit<ComponentProps<typeof Badge>, "variant" | "children">

/**
 * The notes announce breaking changes, or the version is a new major version. Passes other
 * props on, so it can be a tooltip trigger.
 */
export function BreakingBadge({ className, ...props }: BadgeProps) {
  return (
    <Badge variant="destructive" className={cn("shrink-0", className)} {...props}>
      <ZapIcon data-icon="inline-start" />
      Breaking
    </Badge>
  )
}

export function PrereleaseBadge({ className, ...props }: BadgeProps) {
  return (
    <Badge variant="outline" className={cn("shrink-0", className)} {...props}>
      Pre-release
    </Badge>
  )
}
