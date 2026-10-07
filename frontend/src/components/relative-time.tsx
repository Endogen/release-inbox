import { Hint } from "@/components/hint"
import { useNow } from "@/hooks/use-now"
import { formatAbsolute, formatAge, formatRelative } from "@/lib/time"

interface RelativeTimeProps {
  date: string
  /** "short" renders "5m", "long" renders "5 minutes ago". */
  format?: "short" | "long"
  className?: string
}

export function RelativeTime({ date, format = "long", className }: RelativeTimeProps) {
  const now = useNow()
  const label = format === "short" ? formatAge(date, now) : formatRelative(date, now)

  return (
    <Hint label={formatAbsolute(date)}>
      <time dateTime={date} className={className}>
        {label}
      </time>
    </Hint>
  )
}
