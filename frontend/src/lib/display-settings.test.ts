// @vitest-environment jsdom
import { describe, expect, it } from "vitest"

import { DEFAULT_DISPLAY_SETTINGS, parseDisplaySettings } from "./display-settings"

describe("parseDisplaySettings", () => {
  it("uses the defaults for nothing stored or broken JSON", () => {
    expect(parseDisplaySettings(null)).toEqual(DEFAULT_DISPLAY_SETTINGS)
    expect(parseDisplaySettings("{nope")).toEqual(DEFAULT_DISPLAY_SETTINGS)
    expect(parseDisplaySettings("42")).toEqual(DEFAULT_DISPLAY_SETTINGS)
  })

  it("keeps valid values and replaces invalid ones", () => {
    const stored = JSON.stringify({
      stars: false,
      compactList: "yes",
      dates: "absolute",
      openOn: "x",
    })

    expect(parseDisplaySettings(stored)).toEqual({
      ...DEFAULT_DISPLAY_SETTINGS,
      stars: false,
      dates: "absolute",
    })
  })
})
