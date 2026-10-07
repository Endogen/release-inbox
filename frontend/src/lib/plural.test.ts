import { describe, expect, it } from "vitest"

import { plural } from "./plural"

describe("plural", () => {
  it("uses the singular only for one", () => {
    expect(plural(0, "release")).toBe("0 releases")
    expect(plural(1, "release")).toBe("1 release")
    expect(plural(2, "release")).toBe("2 releases")
  })
})
