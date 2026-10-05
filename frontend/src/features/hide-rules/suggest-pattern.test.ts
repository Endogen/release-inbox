import { describe, expect, it } from "vitest"

import { suggestPattern } from "./suggest-pattern"

describe("suggestPattern", () => {
  it.each([
    ["web@1.2.3", null, "web@*"],
    ["@scope/pkg@1.2.3", null, "@scope/pkg@*"],
    ["nightly-20261005-138ca5d", "afm-next (20261005 · 138ca5d)", "nightly-*"],
    ["release-v2.0.0", null, "release-*"],
    ["py3-lib-1.0", null, "py3-lib-*"],
  ])("replaces the version of %s", (tag, name, expected) => {
    expect(suggestPattern(tag, name)).toBe(expected)
  })

  it("falls back to the name when the tag is only a version", () => {
    expect(suggestPattern("v0.9.0", "Suna 0.9")).toBe("Suna *")
  })

  it("keeps the exact tag when no component prefix exists", () => {
    expect(suggestPattern("v0.70.11", "0.70.11")).toBe("v0.70.11")
  })
})
