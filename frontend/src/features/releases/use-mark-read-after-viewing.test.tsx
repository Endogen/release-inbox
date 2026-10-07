// @vitest-environment jsdom
import { cleanup, renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import type { Release } from "@/lib/api/types"
import { makeRelease, makeRepository } from "@/test/fixtures"

import { useMarkReadAfterViewing } from "./use-mark-read-after-viewing"

const APP = makeRelease({ id: 1, repository: makeRepository({ id: 10 }) })
const APP_OLDER = makeRelease({ id: 2, repository: makeRepository({ id: 10 }) })
const TOOL = makeRelease({ id: 3, repository: makeRepository({ id: 20 }) })

function setup(enabled = true) {
  const markRead = vi.fn()
  const hook = renderHook(
    ({ selected }: { selected: Release | undefined }) =>
      useMarkReadAfterViewing(selected, { enabled, markRead }),
    { initialProps: { selected: APP as Release | undefined } }
  )
  return { markRead, ...hook }
}

describe("useMarkReadAfterViewing", () => {
  afterEach(cleanup)

  it("marks a release as read when moving on to another repository or closing it", () => {
    const { markRead, rerender } = setup()

    rerender({ selected: TOOL })
    expect(markRead).toHaveBeenLastCalledWith(APP)

    rerender({ selected: undefined })
    expect(markRead).toHaveBeenLastCalledWith(TOOL)
    expect(markRead).toHaveBeenCalledTimes(2)
  })

  it("stays on the entry while switching versions", () => {
    const { markRead, rerender } = setup()

    rerender({ selected: APP_OLDER })

    expect(markRead).not.toHaveBeenCalled()
  })

  it("leaves read releases, actions that move on and a disabled setting alone", () => {
    const read = { ...APP, read_at: "2026-10-01T10:00:00Z" }
    const { markRead, rerender, result } = setup()
    rerender({ selected: read })
    rerender({ selected: TOOL })
    expect(markRead).not.toHaveBeenCalled()

    result.current()
    rerender({ selected: undefined })
    expect(markRead).not.toHaveBeenCalled()

    const disabled = setup(false)
    disabled.rerender({ selected: TOOL })
    expect(disabled.markRead).not.toHaveBeenCalled()
  })
})
