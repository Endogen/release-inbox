// @vitest-environment jsdom
import { cleanup, renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import type { DesktopStatus } from "@/lib/desktop"

import { desktopStatus, useDesktopStatus } from "./use-desktop-status"

const desktop = vi.hoisted(() => ({
  active: true,
  setDesktopStatus: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("@/lib/desktop", () => ({
  isDesktop: () => desktop.active,
  setDesktopStatus: desktop.setDesktopStatus,
}))

describe("desktopStatus", () => {
  it("follows what the page shows", () => {
    expect(desktopStatus(true, false, false, undefined)).toBeUndefined()
    expect(desktopStatus(false, true, true, true)).toBe("disconnected")
    expect(desktopStatus(false, false, false, undefined)).toBe("signed-out")
    expect(desktopStatus(false, false, true, undefined)).toBeUndefined()
    expect(desktopStatus(false, false, true, true)).toBe("connected")
    expect(desktopStatus(false, false, true, false)).toBe("disconnected")
  })
})

describe("useDesktopStatus", () => {
  afterEach(() => {
    cleanup()
    desktop.active = true
    desktop.setDesktopStatus.mockClear()
  })

  it("reports changes only", () => {
    const { rerender } = renderHook(
      (status: DesktopStatus | undefined) => useDesktopStatus(status),
      {
        initialProps: undefined,
      }
    )
    rerender("connected")
    rerender("connected")
    rerender("signed-out")

    expect(desktop.setDesktopStatus.mock.calls).toEqual([["connected"], ["signed-out"]])
  })

  it("reports nothing in the browser", () => {
    desktop.active = false
    renderHook(() => useDesktopStatus("connected"))

    expect(desktop.setDesktopStatus).not.toHaveBeenCalled()
  })
})
