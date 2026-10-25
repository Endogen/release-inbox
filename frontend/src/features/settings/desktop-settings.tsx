import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { Button } from "@/components/ui/button"
import { FieldDescription, FieldLegend, FieldSet } from "@/components/ui/field"
import { Skeleton } from "@/components/ui/skeleton"
import { getDesktopSettings, setDesktopTrayEnabled } from "@/lib/desktop"

import { SwitchField } from "./setting-fields"

const desktopSettingsKey = ["desktop-settings"] as const

/** Only mounted in the desktop app; changing servers doesn't change these preferences. */
export function DesktopSettings() {
  const client = useQueryClient()
  const settings = useQuery({
    queryKey: desktopSettingsKey,
    queryFn: getDesktopSettings,
    retry: false,
  })
  const update = useMutation({
    mutationFn: setDesktopTrayEnabled,
    onMutate: () => client.cancelQueries({ queryKey: desktopSettingsKey }),
    onSuccess: (saved) => client.setQueryData(desktopSettingsKey, saved),
  })

  return (
    <FieldSet>
      <FieldLegend>Desktop</FieldLegend>
      <FieldDescription>Only on this device.</FieldDescription>
      {settings.data ? (
        <SwitchField
          label="Enable tray icon"
          description={
            settings.data.tray_enabled
              ? "Closing the window keeps the app running in the tray. Its taskbar or Dock icon returns when you reopen it."
              : "The app stays in the taskbar or Dock while running. Closing the window quits it."
          }
          checked={settings.data.tray_enabled}
          disabled={update.isPending}
          busy={update.isPending}
          onCheckedChange={(enabled) => update.mutate(enabled)}
        />
      ) : settings.isError ? (
        <div className="flex flex-col items-start gap-2">
          <p role="alert" className="text-sm text-muted-foreground">
            Couldn't load desktop settings. Try again or update the desktop app.
          </p>
          <Button variant="outline" size="sm" onClick={() => void settings.refetch()}>
            Try again
          </Button>
        </div>
      ) : (
        <Skeleton className="h-10 w-full" />
      )}
      {update.isError && (
        <p role="alert" className="text-sm text-destructive">
          Couldn't change the tray setting. Please try again.
        </p>
      )}
    </FieldSet>
  )
}
