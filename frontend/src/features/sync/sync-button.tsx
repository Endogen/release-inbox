import { RefreshCwIcon, TriangleAlertIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useNow } from "@/hooks/use-now"
import { formatRelative } from "@/lib/time"
import { cn } from "@/lib/utils"

import { useSync } from "./api"

export function SyncButton() {
  const now = useNow()
  const { status, inProgress, syncNow } = useSync()
  const failed = Boolean(status?.last_error) && !inProgress

  const label = inProgress
    ? "Checking GitHub for new releases…"
    : status?.last_error
      ? `The last sync failed: ${status.last_error}`
      : status?.last_synced_at
        ? `Synced ${formatRelative(status.last_synced_at, now)}. Sync now`
        : "Sync now"

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Sync now"
          aria-busy={inProgress}
          onClick={inProgress ? undefined : syncNow}
        >
          {failed ? (
            <TriangleAlertIcon className="text-destructive" />
          ) : (
            <RefreshCwIcon className={cn(inProgress && "animate-spin")} />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent className="max-w-72">{label}</TooltipContent>
    </Tooltip>
  )
}
