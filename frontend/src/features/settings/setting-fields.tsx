import { useId, type ReactNode } from "react"

import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field"
import { Switch } from "@/components/ui/switch"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

interface SwitchFieldProps {
  label: string
  description?: ReactNode
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
  busy?: boolean
}

/** A setting that is on or off. */
export function SwitchField({
  label,
  description,
  checked,
  onCheckedChange,
  disabled = false,
  busy = false,
}: SwitchFieldProps) {
  const id = useId()
  return (
    <Field orientation="horizontal" data-disabled={disabled || undefined}>
      <FieldContent>
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        {description && <FieldDescription id={`${id}-description`}>{description}</FieldDescription>}
      </FieldContent>
      <Switch
        id={id}
        aria-describedby={description ? `${id}-description` : undefined}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        aria-busy={busy}
      />
    </Field>
  )
}

interface ChoiceFieldProps<T extends string> {
  label: string
  description?: ReactNode
  value: T
  options: ReadonlyArray<{ value: T; label: string }>
  onValueChange: (value: T) => void
}

/** One of a few options, as a segmented control; it moves below the label where space is short. */
export function ChoiceField<T extends string>({
  label,
  description,
  value,
  options,
  onValueChange,
}: ChoiceFieldProps<T>) {
  const id = useId()
  return (
    <Field orientation="horizontal" className="flex-wrap">
      <FieldContent className="min-w-36">
        <FieldTitle id={`${id}-label`}>{label}</FieldTitle>
        {description && <FieldDescription id={`${id}-description`}>{description}</FieldDescription>}
      </FieldContent>
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        spacing={0}
        value={value}
        aria-labelledby={`${id}-label`}
        aria-describedby={description ? `${id}-description` : undefined}
        // Choosing the selected option again would clear the value; there always is one.
        onValueChange={(next) => {
          const option = options.find((item) => item.value === next)
          if (option) onValueChange(option.value)
        }}
      >
        {options.map((option) => (
          <ToggleGroupItem
            key={option.value}
            value={option.value}
            // As clear as a switch that is on.
            className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:hover:bg-primary/90"
          >
            {option.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </Field>
  )
}
