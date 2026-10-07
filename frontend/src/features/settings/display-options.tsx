import { FieldDescription, FieldLegend, FieldSet } from "@/components/ui/field"
import { useTheme } from "@/features/theme/use-theme"
import type { Theme } from "@/features/theme/context"
import {
  updateDisplaySettings,
  useDisplaySettings,
  type ContentTab,
  type DisplaySettings,
} from "@/lib/display-settings"

import { ChoiceField, SwitchField } from "./setting-fields"

const THEMES: ReadonlyArray<{ value: Theme; label: string }> = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
]

const DATES: ReadonlyArray<{ value: DisplaySettings["dates"]; label: string }> = [
  { value: "relative", label: "3h ago" },
  { value: "absolute", label: "Oct 7" },
]

const OPEN_ON: ReadonlyArray<{ value: ContentTab; label: string }> = [
  { value: "notes", label: "Notes" },
  { value: "changes", label: "What's new" },
  { value: "readme", label: "README" },
]

/** How the app looks; kept on this device. */
export function DisplayOptions() {
  const { theme, setTheme } = useTheme()
  const display = useDisplaySettings()

  return (
    <FieldSet>
      <FieldLegend>Display</FieldLegend>
      <FieldDescription>Only on this device.</FieldDescription>
      <ChoiceField label="Theme" value={theme} options={THEMES} onValueChange={setTheme} />
      <SwitchField
        label="Star counts"
        checked={display.stars}
        onCheckedChange={(stars) => updateDisplaySettings({ stars })}
      />
      <SwitchField
        label="Compact list"
        description="Smaller rows, so more fit on the screen."
        checked={display.compactList}
        onCheckedChange={(compactList) => updateDisplaySettings({ compactList })}
      />
      <ChoiceField
        label="Dates"
        value={display.dates}
        options={DATES}
        onValueChange={(dates) => updateDisplaySettings({ dates })}
      />
      <ChoiceField
        label="Open releases on"
        description="What's new lists the unread releases of an entry."
        value={display.openOn}
        options={OPEN_ON}
        onValueChange={(openOn) => updateDisplaySettings({ openOn })}
      />
    </FieldSet>
  )
}
