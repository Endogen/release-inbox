import { RefreshCwIcon, TriangleAlertIcon } from "lucide-react"

import { RelativeTime } from "@/components/relative-time"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { FieldDescription, FieldLegend, FieldSet } from "@/components/ui/field"
import { Spinner } from "@/components/ui/spinner"
import { useSync } from "@/features/sync/api"

export function SyncSettings() {
  const { status, inProgress, syncNow } = useSync()

  return (
    <FieldSet>
      <FieldLegend>Sync</FieldLegend>
      <FieldDescription>
        GitHub is checked for new releases about once a minute.{" "}
        {status?.last_synced_at && (
          <>
            Last checked <RelativeTime date={status.last_synced_at} />.
          </>
        )}
      </FieldDescription>
      {status?.last_error && (
        <Alert variant="destructive">
          <TriangleAlertIcon />
          <AlertTitle>The last sync failed</AlertTitle>
          <AlertDescription>{status.last_error}</AlertDescription>
        </Alert>
      )}
      <Button
        variant="outline"
        size="sm"
        className="self-start"
        aria-busy={inProgress}
        onClick={inProgress ? undefined : syncNow}
      >
        {inProgress ? (
          <Spinner data-icon="inline-start" />
        ) : (
          <RefreshCwIcon data-icon="inline-start" />
        )}
        {inProgress ? "Syncing…" : "Sync now"}
      </Button>
    </FieldSet>
  )
}
