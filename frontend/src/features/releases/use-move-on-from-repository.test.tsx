// @vitest-environment jsdom
import { cleanup, renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import type { Release } from "@/lib/api/types"
import { makeRelease, makeRepository } from "@/test/fixtures"

import { useMoveOnFromRepository } from "./use-move-on-from-repository"

const APP = makeRelease({ id: 1, repository: makeRepository({ id: 10 }) })
const APP_OLDER = makeRelease({ id: 2, repository: makeRepository({ id: 10 }) })
const TOOL = makeRelease({ id: 3, repository: makeRepository({ id: 20 }) })

function setup(enabled = true) {
  const onMoveOn = vi.fn()
  const hook = renderHook(
    ({ selected }: { selected: Release | undefined }) =>
      useMoveOnFromRepository(selected, { enabled, onMoveOn }),
    { initialProps: { selected: APP as Release | undefined } }
  )
  return { onMoveOn, ...hook }
}

describe("useMoveOnFromRepository", () => {
  afterEach(cleanup)

  it("reports the release when moving on to another repository or closing it", () => {
    const { onMoveOn, rerender } = setup()

    rerender({ selected: TOOL })
    expect(onMoveOn).toHaveBeenLastCalledWith(APP)

    rerender({ selected: undefined })
    expect(onMoveOn).toHaveBeenLastCalledWith(TOOL)
    expect(onMoveOn).toHaveBeenCalledTimes(2)
  })

  it("stays on the repository while switching versions, and reports the one shown last", () => {
    const { onMoveOn, rerender } = setup()

    rerender({ selected: APP_OLDER })
    expect(onMoveOn).not.toHaveBeenCalled()

    rerender({ selected: TOOL })
    expect(onMoveOn).toHaveBeenCalledWith(APP_OLDER)
  })

  it("ignores moves made by actions, and does nothing while disabled", () => {
    const { onMoveOn, rerender, result } = setup()
    result.current()
    rerender({ selected: TOOL })
    expect(onMoveOn).not.toHaveBeenCalled()

    rerender({ selected: undefined })
    expect(onMoveOn).toHaveBeenCalledTimes(1)

    const disabled = setup(false)
    disabled.rerender({ selected: TOOL })
    expect(disabled.onMoveOn).not.toHaveBeenCalled()
  })
})
