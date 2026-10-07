// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { DEFAULT_DISPLAY_SETTINGS, updateDisplaySettings } from "@/lib/display-settings"

import { useContentTab } from "./use-content-tab"

function setup(initial: { repositoryId: number | undefined; whatsNewCount: number }) {
  return renderHook(
    ({ repositoryId, whatsNewCount }) => useContentTab(repositoryId, whatsNewCount),
    { initialProps: initial }
  )
}

describe("useContentTab", () => {
  afterEach(() => {
    cleanup()
    updateDisplaySettings(DEFAULT_DISPLAY_SETTINGS)
  })

  it("opens on the preferred tab, falling back to the notes without What's new", () => {
    updateDisplaySettings({ openOn: "changes" })
    const { result, rerender } = setup({ repositoryId: 10, whatsNewCount: 3 })
    expect(result.current.tab).toBe("changes")

    rerender({ repositoryId: 20, whatsNewCount: 0 })
    expect(result.current.tab).toBe("notes")
  })

  it("keeps a chosen tab while its repository is shown, and forgets it afterwards", () => {
    const { result, rerender } = setup({ repositoryId: 10, whatsNewCount: 0 })

    act(() => result.current.choose("readme"))
    expect(result.current.tab).toBe("readme")

    rerender({ repositoryId: 20, whatsNewCount: 0 })
    expect(result.current.tab).toBe("notes")
    rerender({ repositoryId: 10, whatsNewCount: 0 })
    expect(result.current.tab).toBe("notes")
  })

  it("cycles through the tabs there are", () => {
    const { result } = setup({ repositoryId: 10, whatsNewCount: 0 })

    act(() => result.current.cycle())
    expect(result.current.tab).toBe("readme")
    act(() => result.current.cycle())
    expect(result.current.tab).toBe("notes")
  })
})
