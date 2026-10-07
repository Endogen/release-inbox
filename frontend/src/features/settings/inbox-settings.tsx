import { FieldLegend, FieldSet } from "@/components/ui/field"
import { Skeleton } from "@/components/ui/skeleton"
import { usePreferences, useUpdatePreferences } from "@/features/preferences/api"
import type { PrereleaseMode } from "@/lib/api/types"

import { ChoiceField, SwitchField } from "./setting-fields"

const PRERELEASE_MODES: ReadonlyArray<{
  value: PrereleaseMode
  label: string
  description: string
}> = [
  { value: "show", label: "Show", description: "In the inbox, with a notification." },
  { value: "mute", label: "Quiet", description: "In the inbox, without a notification." },
  { value: "hide", label: "Hide", description: "In the Hidden view, without a notification." },
]

export function InboxSettings() {
  const preferences = usePreferences()
  const update = useUpdatePreferences()

  if (!preferences.data) {
    return <Skeleton className="h-48 w-full" />
  }
  const { prereleases, mark_read_after_viewing, app_badge } = preferences.data
  const mode = PRERELEASE_MODES.find((item) => item.value === prereleases)

  return (
    <FieldSet>
      <FieldLegend>Inbox</FieldLegend>
      <ChoiceField
        label="Pre-releases"
        description={`Betas and release candidates. ${mode?.description ?? ""}`}
        value={prereleases}
        options={PRERELEASE_MODES}
        onValueChange={(value) => update.mutate({ prereleases: value })}
      />
      <SwitchField
        label="Mark as read after viewing"
        description="When you move on to another repository or close the release."
        checked={mark_read_after_viewing}
        onCheckedChange={(checked) => update.mutate({ mark_read_after_viewing: checked })}
      />
      <SwitchField
        label="Count on the app icon"
        description="The number of inbox entries, where the app is installed."
        checked={app_badge}
        onCheckedChange={(checked) => update.mutate({ app_badge: checked })}
      />
    </FieldSet>
  )
}
