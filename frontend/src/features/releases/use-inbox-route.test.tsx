// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react"
import type { ReactNode } from "react"
import { MemoryRouter, Route, Routes, useLocation, useNavigationType } from "react-router"
import { afterEach, describe, expect, it } from "vitest"

import { useInboxRoute } from "./use-inbox-route"

function setup(entry: string) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={["/inbox", entry]} initialIndex={1}>
      <Routes>
        <Route path="/:view" element={children} />
      </Routes>
    </MemoryRouter>
  )
  return renderHook(
    () => ({ route: useInboxRoute(), location: useLocation(), navigation: useNavigationType() }),
    { wrapper }
  )
}

describe("useInboxRoute", () => {
  afterEach(cleanup)

  it("reads view, search and release from the URL", () => {
    const { result } = setup("/read?q=react&release=42")

    expect(result.current.route.view).toBe("read")
    expect(result.current.route.search).toBe("react")
    expect(result.current.route.releaseId).toBe(42)
  })

  it("falls back to the inbox and ignores invalid ids", () => {
    const { result } = setup("/bogus?release=abc")

    expect(result.current.route.view).toBe("inbox")
    expect(result.current.route.releaseId).toBeNull()
  })

  it("opening from the list pushes a history entry that back returns from", () => {
    const { result } = setup("/inbox?q=x")

    act(() => result.current.route.selectRelease(7, { push: true }))
    expect(result.current.location.search).toBe("?q=x&release=7")
    expect(result.current.navigation).toBe("PUSH")

    act(() => result.current.route.closeRelease())
    expect(result.current.location.search).toBe("?q=x")
    // Back went to the list entry instead of adding another one.
    expect(result.current.navigation).toBe("POP")
  })

  it("closing a release that wasn't opened from the list just deselects it", () => {
    const { result } = setup("/inbox?release=7")

    act(() => result.current.route.closeRelease())

    expect(result.current.location.search).toBe("")
    expect(result.current.navigation).toBe("REPLACE")
  })

  it("keeps the search when switching views", () => {
    const { result } = setup("/inbox?q=lib&release=3")

    act(() => result.current.route.setView("hidden"))

    expect(result.current.location.pathname).toBe("/hidden")
    expect(result.current.location.search).toBe("?q=lib")
  })
})
