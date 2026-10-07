import { cn } from "cn"
import { RefreshCwIcon, TriangleAlertIcon } from "lucide-react"

import { Hint } from "@/components/hint"
import { Button } from "@/components/ui/button"
import { useNow } from "@/hooks/use-now"
import { formatRelative } from "@/lib/time"

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
    <Hint label={label} className="max-w-72">
      <Button
        variant="ghost"
        size="icon"
        aria-label="Sync now"
        aria-busy={inProgress}
        onClick={syncNow}
      >
        {failed ? (
          <TriangleAlertIcon className="text-destructive" />
        ) : (
          <RefreshCwIcon className={cn(inProgress && "animate-spin")} />
        )}
      </Button>
    </Hint>
  )
}
