// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { useRowGestures } from "./use-row-gestures"

function Row({
  onLeft,
  onRight,
  onLongPress,
  onClick,
}: {
  onLeft?: () => void
  onRight?: () => void
  onLongPress?: () => void
  onClick: () => void
}) {
  const gestures = useRowGestures({ onSwipeLeft: onLeft, onSwipeRight: onRight, onLongPress })
  return (
    <div
      data-testid="row"
      data-offset={gestures.offset}
      data-armed={gestures.armed}
      data-held={gestures.held}
      {...gestures.handlers}
    >
      <button type="button" onClick={onClick}>
        open
      </button>
    </div>
  )
}

function drag(element: HTMLElement, dx: number, dy = 0) {
  const pointer = { pointerId: 1, pointerType: "touch", button: 0 }
  fireEvent.pointerDown(element, { ...pointer, clientX: 200, clientY: 100 })
  fireEvent.pointerMove(element, { ...pointer, clientX: 200 + dx / 2, clientY: 100 + dy / 2 })
  fireEvent.pointerMove(element, { ...pointer, clientX: 200 + dx, clientY: 100 + dy })
  fireEvent.pointerUp(element, { ...pointer, clientX: 200 + dx, clientY: 100 + dy })
}

describe("useRowGestures", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    // jsdom has no layout; give the row a width and accept pointer capture.
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      width: 400,
    } as DOMRect)
    HTMLElement.prototype.setPointerCapture = vi.fn()
  })
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it("triggers the action after a long enough swipe", () => {
    const onLeft = vi.fn()
    render(<Row onLeft={onLeft} onClick={vi.fn()} />)

    drag(screen.getByTestId("row"), -200)
    act(() => vi.advanceTimersByTime(500))

    expect(onLeft).toHaveBeenCalledOnce()
  })

  it("snaps back from a short swipe", () => {
    const onLeft = vi.fn()
    render(<Row onLeft={onLeft} onClick={vi.fn()} />)

    drag(screen.getByTestId("row"), -60)
    act(() => vi.advanceTimersByTime(500))

    expect(onLeft).not.toHaveBeenCalled()
    expect(screen.getByTestId("row").dataset.offset).toBe("0")
  })

  it("leaves vertical scrolling alone", () => {
    const onLeft = vi.fn()
    render(<Row onLeft={onLeft} onClick={vi.fn()} />)

    drag(screen.getByTestId("row"), -40, 200)

    expect(onLeft).not.toHaveBeenCalled()
    expect(screen.getByTestId("row").dataset.offset).toBe("0")
  })

  it("only rubber-bands in a direction without an action", () => {
    render(<Row onLeft={vi.fn()} onClick={vi.fn()} />)
    const row = screen.getByTestId("row")
    const pointer = { pointerId: 1, pointerType: "touch", button: 0 }

    fireEvent.pointerDown(row, { ...pointer, clientX: 100, clientY: 100 })
    fireEvent.pointerMove(row, { ...pointer, clientX: 300, clientY: 100 })

    expect(Number(row.dataset.offset)).toBeLessThanOrEqual(24)
  })

  it("doesn't swallow the tap after an aborted swipe", () => {
    const onClick = vi.fn()
    render(<Row onLeft={vi.fn()} onClick={onClick} />)

    drag(screen.getByTestId("row"), -40)
    act(() => vi.advanceTimersByTime(10))
    fireEvent.click(screen.getByRole("button"))

    expect(onClick).toHaveBeenCalledOnce()
  })

  describe("long press", () => {
    const touch = { pointerId: 1, pointerType: "touch", button: 0, clientX: 100, clientY: 100 }

    it("acts when the finger lifts after holding still, instead of a tap", () => {
      const onLongPress = vi.fn()
      const onClick = vi.fn()
      render(<Row onLongPress={onLongPress} onClick={onClick} />)
      const row = screen.getByTestId("row")

      fireEvent.pointerDown(row, touch)
      act(() => vi.advanceTimersByTime(499))
      expect(row.dataset.held).toBe("false")
      act(() => vi.advanceTimersByTime(1))
      expect(row.dataset.held).toBe("true")
      expect(onLongPress).not.toHaveBeenCalled()

      fireEvent.pointerUp(row, touch)
      fireEvent.click(screen.getByRole("button"))

      expect(onLongPress).toHaveBeenCalledOnce()
      expect(onClick).not.toHaveBeenCalled()
    })

    it("is a tap when released early, and nothing once the finger moves", () => {
      const onLongPress = vi.fn()
      render(<Row onLongPress={onLongPress} onClick={vi.fn()} />)
      const row = screen.getByTestId("row")

      fireEvent.pointerDown(row, touch)
      act(() => vi.advanceTimersByTime(300))
      fireEvent.pointerUp(row, touch)

      fireEvent.pointerDown(row, touch)
      fireEvent.pointerMove(row, { ...touch, clientY: 130 })
      act(() => vi.advanceTimersByTime(800))
      fireEvent.pointerUp(row, { ...touch, clientY: 130 })

      expect(onLongPress).not.toHaveBeenCalled()
    })

    it("ignores the mouse", () => {
      const onLongPress = vi.fn()
      render(<Row onLongPress={onLongPress} onClick={vi.fn()} />)
      const row = screen.getByTestId("row")

      fireEvent.pointerDown(row, { ...touch, pointerType: "mouse" })
      act(() => vi.advanceTimersByTime(800))
      fireEvent.pointerUp(row, { ...touch, pointerType: "mouse" })

      expect(onLongPress).not.toHaveBeenCalled()
    })

    it("still acts when the browser cancels a held touch for its own menu", () => {
      const onLongPress = vi.fn()
      render(<Row onLongPress={onLongPress} onClick={vi.fn()} />)
      const row = screen.getByTestId("row")

      fireEvent.pointerDown(row, touch)
      act(() => vi.advanceTimersByTime(600))
      const menu = fireEvent.contextMenu(row)
      fireEvent.pointerCancel(row, touch)

      expect(menu).toBe(false) // the browser's menu was prevented
      expect(onLongPress).toHaveBeenCalledOnce()
    })
  })
})
