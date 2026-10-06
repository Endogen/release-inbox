/** Preset snooze times, in the user's local time zone. */

export interface SnoozeOption {
  id: "later-today" | "tomorrow" | "weekend" | "next-week"
  label: string
  until: Date
}

const MORNING_HOUR = 9
const LATER_TODAY_HOURS = 3
const FRIDAY = 5
const SATURDAY = 6
const SUNDAY = 0
const MONDAY = 1

function atMorning(date: Date, daysAhead: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + daysAhead)
  result.setHours(MORNING_HOUR, 0, 0, 0)
  return result
}

function daysUntil(now: Date, weekday: number): number {
  const days = (weekday - now.getDay() + 7) % 7
  return days === 0 ? 7 : days
}

export function snoozeOptions(now: Date): SnoozeOption[] {
  const options: SnoozeOption[] = [
    {
      id: "later-today",
      label: "Later today",
      until: new Date(now.getTime() + LATER_TODAY_HOURS * 60 * 60 * 1000),
    },
    { id: "tomorrow", label: "Tomorrow", until: atMorning(now, 1) },
  ]
  // From Friday on, "tomorrow" already is the weekend.
  if (![FRIDAY, SATURDAY, SUNDAY].includes(now.getDay())) {
    options.push({
      id: "weekend",
      label: "This weekend",
      until: atMorning(now, daysUntil(now, SATURDAY)),
    })
  }
  options.push({ id: "next-week", label: "Next week", until: atMorning(now, daysUntil(now, MONDAY)) })
  return options
}
