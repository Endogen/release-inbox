import { CloudDownloadIcon, TriangleAlertIcon } from "lucide-react"

import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"

import { useSync } from "./api"

/** Explains an empty or outdated list: the first import is running, or syncing fails. */
export function SyncBanner() {
  const { status, inProgress, syncNow } = useSync()
  if (!status) return null

  if (status.last_synced_at === null && !status.last_error) {
    return (
      <Alert>
        {inProgress ? <Spinner /> : <CloudDownloadIcon />}
        <AlertTitle>Importing your releases</AlertTitle>
        <AlertDescription>
          The first sync fetches your release notifications from GitHub. They appear here as they
          arrive.
        </AlertDescription>
      </Alert>
    )
  }

  if (!status.last_error) return null
  return (
    <Alert variant="destructive">
      <TriangleAlertIcon />
      <AlertTitle>Syncing with GitHub fails</AlertTitle>
      <AlertDescription>
        {status.last_error} New releases show up once it works again; it retries by itself.
      </AlertDescription>
      <AlertAction>
        <Button size="xs" variant="outline" aria-busy={inProgress} onClick={syncNow}>
          Retry
        </Button>
      </AlertAction>
    </Alert>
  )
}
