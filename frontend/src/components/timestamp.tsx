import { Hint } from "@/components/hint"
import { useNow } from "@/hooks/use-now"
import { useDisplaySettings } from "@/lib/display-settings"
import { formatAbsolute, formatAge, formatDate, formatRelative } from "@/lib/time"

interface TimestampProps {
  date: string
  /** "short" renders "5m" or "Oct 7", "long" renders "5 minutes ago" or the date and time. */
  format?: "short" | "long"
  className?: string
}

/** A point in time, relative or as a date as the display settings say; the hint has the other. */
export function Timestamp({ date, format = "long", className }: TimestampProps) {
  const now = useNow()
  const { dates } = useDisplaySettings()
  const relative = format === "short" ? formatAge(date, now) : formatRelative(date, now)
  const absolute = format === "short" ? formatDate(date, now) : formatAbsolute(date)
  const [label, hint] =
    dates === "relative" ? [relative, formatAbsolute(date)] : [absolute, formatRelative(date, now)]

  return (
    <Hint label={hint}>
      <time dateTime={date} className={className}>
        {label}
      </time>
    </Hint>
  )
}
