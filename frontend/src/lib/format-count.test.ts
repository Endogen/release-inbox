import { describe, expect, it } from "vitest"

import { formatCount } from "./format-count"

describe("formatCount", () => {
  it("shortens large counts like GitHub", () => {
    expect(formatCount(0)).toBe("0")
    expect(formatCount(950)).toBe("950")
    expect(formatCount(12_400)).toBe("12.4k")
    expect(formatCount(12_000)).toBe("12k")
    expect(formatCount(1_250_000)).toBe("1.3M")
  })
})
