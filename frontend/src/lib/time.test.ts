import { describe, expect, it } from "vitest"

import { formatAge, formatDate, formatRelative } from "./time"

const NOW = Date.parse("2026-10-05T12:00:00Z")
const ago = (milliseconds: number) => new Date(NOW - milliseconds).toISOString()

describe("formatAge", () => {
  it.each([
    [10_000, "now"],
    [5 * 60_000, "5m"],
    [3 * 3_600_000, "3h"],
    [2 * 86_400_000, "2d"],
    [14 * 86_400_000, "2w"],
    [70 * 86_400_000, "2mo"],
    [400 * 86_400_000, "1y"],
  ])("formats %i ms as %s", (age, expected) => {
    expect(formatAge(ago(age), NOW)).toBe(expected)
  })

  it("treats future dates as now", () => {
    expect(formatAge(ago(-60_000), NOW)).toBe("now")
  })
})

describe("formatRelative", () => {
  it("spells out the age", () => {
    expect(formatRelative(ago(5 * 60_000), NOW)).toMatch(/5 minutes ago/)
  })
})

describe("formatDate", () => {
  it("adds the year only for other years", () => {
    expect(formatDate("2026-03-04T12:00:00Z", NOW)).not.toMatch(/2026/)
    expect(formatDate("2025-03-04T12:00:00Z", NOW)).toMatch(/2025/)
  })
})
