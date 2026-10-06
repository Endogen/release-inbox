// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { SearchBox } from "./search-box"

describe("SearchBox", () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  const input = () => screen.getByRole<HTMLInputElement>("searchbox")

  it("commits the trimmed text once typing pauses", () => {
    const onCommit = vi.fn()
    render(<SearchBox value="" onCommit={onCommit} />)

    fireEvent.change(input(), { target: { value: "  web " } })
    act(() => vi.advanceTimersByTime(100))
    expect(onCommit).not.toHaveBeenCalled()

    act(() => vi.advanceTimersByTime(250))
    expect(onCommit).toHaveBeenCalledExactlyOnceWith("web")
  })

  it("takes over a value set from elsewhere without committing it back", () => {
    const onCommit = vi.fn()
    const { rerender } = render(<SearchBox value="" onCommit={onCommit} />)

    rerender(<SearchBox value="api" onCommit={onCommit} />)
    act(() => vi.advanceTimersByTime(500))

    expect(input().value).toBe("api")
    expect(onCommit).not.toHaveBeenCalled()
  })

  it("clears with Escape", () => {
    const onCommit = vi.fn()
    render(<SearchBox value="api" onCommit={onCommit} />)

    fireEvent.keyDown(input(), { key: "Escape" })
    act(() => vi.advanceTimersByTime(500))

    expect(input().value).toBe("")
    expect(onCommit).toHaveBeenCalledExactlyOnceWith("")
  })
})
