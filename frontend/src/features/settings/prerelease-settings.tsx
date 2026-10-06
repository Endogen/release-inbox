import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldTitle,
} from "@/components/ui/field"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Skeleton } from "@/components/ui/skeleton"
import { usePreferences, useUpdatePreferences } from "@/features/preferences/api"
import type { PrereleaseMode } from "@/lib/api/types"

const MODES: ReadonlyArray<{ value: PrereleaseMode; title: string; description: string }> = [
  {
    value: "show",
    title: "Like other releases",
    description: "In the inbox, with a notification.",
  },
  {
    value: "mute",
    title: "Without notifications",
    description: "In the inbox, but they don't notify you.",
  },
  {
    value: "hide",
    title: "Hidden",
    description: "Kept in the Hidden view, without notifications.",
  },
]

function isPrereleaseMode(value: string): value is PrereleaseMode {
  return MODES.some((mode) => mode.value === value)
}

export function PrereleaseSettings() {
  const preferences = usePreferences()
  const update = useUpdatePreferences()

  return (
    <FieldSet>
      <FieldLegend>Pre-releases</FieldLegend>
      <FieldDescription>Betas, release candidates and nightly builds.</FieldDescription>
      {preferences.data ? (
        <RadioGroup
          value={preferences.data.prereleases}
          onValueChange={(value) => {
            if (isPrereleaseMode(value)) update.mutate({ prereleases: value })
          }}
        >
          {MODES.map((mode) => (
            <FieldLabel key={mode.value} htmlFor={`prereleases-${mode.value}`}>
              <Field orientation="horizontal">
                <FieldContent>
                  <FieldTitle>{mode.title}</FieldTitle>
                  <FieldDescription>{mode.description}</FieldDescription>
                </FieldContent>
                <RadioGroupItem value={mode.value} id={`prereleases-${mode.value}`} />
              </Field>
            </FieldLabel>
          ))}
        </RadioGroup>
      ) : (
        <Skeleton className="h-52 w-full" />
      )}
    </FieldSet>
  )
}
