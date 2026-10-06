import { describe, expect, it } from "vitest"

import { makeRelease } from "@/test/fixtures"

import { canSnooze, destinationOf, viewOf } from "./release-view"

const NOW = Date.parse("2026-10-06T12:00:00Z")

describe("viewOf", () => {
  it("places every release in exactly one view, hidden first", () => {
    expect(viewOf(makeRelease(), NOW)).toBe("inbox")
    expect(viewOf(makeRelease({ snoozed_until: "2026-10-07T00:00:00Z" }), NOW)).toBe("snoozed")
    expect(viewOf(makeRelease({ snoozed_until: "2026-10-05T00:00:00Z" }), NOW)).toBe("inbox")
    expect(viewOf(makeRelease({ read_at: "2026-10-02T00:00:00Z" }), NOW)).toBe("read")
    expect(viewOf(makeRelease({ read_at: "2026-10-02T00:00:00Z", is_hidden: true }), NOW)).toBe(
      "hidden"
    )
  })
})

describe("canSnooze", () => {
  it("allows unread releases that aren't hidden", () => {
    expect(canSnooze(makeRelease(), NOW)).toBe(true)
    expect(canSnooze(makeRelease({ snoozed_until: "2026-10-07T00:00:00Z" }), NOW)).toBe(true)
    expect(canSnooze(makeRelease({ read_at: "2026-10-02T00:00:00Z" }), NOW)).toBe(false)
    expect(canSnooze(makeRelease({ is_hidden: true }), NOW)).toBe(false)
  })
})

describe("destinationOf", () => {
  it("keeps hidden releases hidden", () => {
    expect(destinationOf(makeRelease(), "read")).toBe("read")
    expect(destinationOf(makeRelease({ is_hidden: true }), "read")).toBe("hidden")
  })
})
