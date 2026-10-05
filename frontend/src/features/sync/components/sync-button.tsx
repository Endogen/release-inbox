import { RefreshCwIcon, TriangleAlertIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useNow } from "@/hooks/use-now"
import { formatRelative } from "@/lib/time"
import { cn } from "@/lib/utils"

import { useSyncNow, useSyncStatus } from "../api"

export function SyncButton() {
  const now = useNow()
  const status = useSyncStatus()
  const syncNow = useSyncNow()
  const inProgress = syncNow.isPending || (status.data?.in_progress ?? false)
  const lastError = status.data?.last_error
  const lastSynced = status.data?.last_synced_at

  const label = inProgress
    ? "Checking GitHub for new releases…"
    : lastError
      ? `The last sync failed: ${lastError}`
      : lastSynced
        ? `Synced ${formatRelative(lastSynced, now)}`
        : "Not synced yet"

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Sync now"
          onClick={() =>
            syncNow.mutate(undefined, {
              onSuccess: (result) => {
                if (result.last_error) toast.error("Sync failed", { description: result.last_error })
              },
            })
          }
          disabled={inProgress}
        >
          {lastError && !inProgress ? (
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
