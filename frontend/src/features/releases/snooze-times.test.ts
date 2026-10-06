import { describe, expect, it } from "vitest"

import { snoozeOptions } from "./snooze-times"

const local = (year: number, month: number, day: number, hour = 0, minute = 0) =>
  new Date(year, month - 1, day, hour, minute)

function byId(now: Date) {
  return Object.fromEntries(snoozeOptions(now).map((option) => [option.id, option.until]))
}

describe("snoozeOptions", () => {
  it("offers presets for a weekday", () => {
    // Tuesday 6 October 2026, 14:30
    const options = byId(local(2026, 10, 6, 14, 30))

    expect(options["later-today"]).toEqual(local(2026, 10, 6, 17, 30))
    expect(options.tomorrow).toEqual(local(2026, 10, 7, 9))
    expect(options.weekend).toEqual(local(2026, 10, 10, 9))
    expect(options["next-week"]).toEqual(local(2026, 10, 12, 9))
  })

  it("skips the weekend option from Friday on", () => {
    expect(byId(local(2026, 10, 9, 10)).weekend).toBeUndefined()
    expect(byId(local(2026, 10, 11, 10)).weekend).toBeUndefined()
  })

  it("on Monday, next week is the following Monday", () => {
    expect(byId(local(2026, 10, 12, 8))["next-week"]).toEqual(local(2026, 10, 19, 9))
  })

  it("on Sunday, tomorrow already is next week", () => {
    const options = snoozeOptions(local(2026, 10, 11, 10))

    expect(options.map((option) => option.id)).toEqual(["later-today", "tomorrow"])
  })

  it("leaves out later today when it would be after midnight", () => {
    expect(byId(local(2026, 10, 6, 22))["later-today"]).toBeUndefined()
  })

  it("handles month ends", () => {
    expect(byId(local(2026, 10, 31, 23)).tomorrow).toEqual(local(2026, 11, 1, 9))
  })
})
