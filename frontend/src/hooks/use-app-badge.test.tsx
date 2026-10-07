// @vitest-environment jsdom
import { cleanup, renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { useAppBadge } from "./use-app-badge"

function stubBadging() {
  const badging = {
    setAppBadge: vi.fn().mockResolvedValue(undefined),
    clearAppBadge: vi.fn().mockResolvedValue(undefined),
  }
  vi.stubGlobal("navigator", badging)
  return badging
}

describe("useAppBadge", () => {
  afterEach(cleanup)

  it("shows the count, clears it at zero and on unmount", () => {
    const badging = stubBadging()
    const { rerender, unmount } = renderHook(({ count }) => useAppBadge(count), {
      initialProps: { count: undefined as number | undefined },
    })
    expect(badging.setAppBadge).not.toHaveBeenCalled()

    rerender({ count: 3 })
    expect(badging.setAppBadge).toHaveBeenLastCalledWith(3)

    rerender({ count: 0 })
    expect(badging.clearAppBadge).toHaveBeenCalledTimes(1)

    unmount()
    expect(badging.clearAppBadge).toHaveBeenCalledTimes(2)
  })

  it("ignores browsers that refuse or don't support badges", () => {
    const badging = stubBadging()
    badging.setAppBadge.mockRejectedValue(new DOMException("Not installed", "NotAllowedError"))
    expect(() => renderHook(() => useAppBadge(2))).not.toThrow()

    vi.stubGlobal("navigator", {})
    expect(() => renderHook(() => useAppBadge(2))).not.toThrow()
  })
})
