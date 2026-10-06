const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const WEEK = 7 * DAY
const MONTH = 30 * DAY
const YEAR = 365 * DAY

const UNITS: ReadonlyArray<{
  size: number
  short: string
  unit: Intl.RelativeTimeFormatUnit
}> = [
  { size: YEAR, short: "y", unit: "year" },
  { size: MONTH, short: "mo", unit: "month" },
  { size: WEEK, short: "w", unit: "week" },
  { size: DAY, short: "d", unit: "day" },
  { size: HOUR, short: "h", unit: "hour" },
  { size: MINUTE, short: "m", unit: "minute" },
]

// Relative phrases match the English UI copy; absolute dates follow the user's locale.
const relativeFormat = new Intl.RelativeTimeFormat("en", { numeric: "auto" })
const absoluteFormat = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
})
const weekdayTimeFormat = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  hour: "numeric",
  minute: "2-digit",
})

function elapsed(date: string | Date, now: number): number {
  return Math.max(0, now - new Date(date).getTime())
}

/** Compact age such as "now", "5m", "3h", "2d" or "4mo". */
export function formatAge(date: string | Date, now: number): string {
  const age = elapsed(date, now)
  const match = UNITS.find(({ size }) => age >= size)
  return match ? `${Math.floor(age / match.size)}${match.short}` : "now"
}

/** Spelled-out age such as "5 minutes ago" or "yesterday". */
export function formatRelative(date: string | Date, now: number): string {
  const age = elapsed(date, now)
  const match = UNITS.find(({ size }) => age >= size)
  if (!match) return "just now"
  return relativeFormat.format(-Math.floor(age / match.size), match.unit)
}

export function formatAbsolute(date: string | Date): string {
  return absoluteFormat.format(new Date(date))
}

/** Weekday and time such as "Tue 9:00 AM", for times within the coming week. */
export function formatWeekdayTime(date: Date): string {
  return weekdayTimeFormat.format(date)
}
