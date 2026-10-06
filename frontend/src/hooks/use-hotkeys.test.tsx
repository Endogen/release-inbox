// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { useHotkeys } from "./use-hotkeys"

function Shortcuts({ onJ, onE }: { onJ: () => void; onE: () => void }) {
  useHotkeys({ j: onJ, e: onE }, { repeatable: ["j"] })
  return <input aria-label="field" />
}

function setup() {
  const onJ = vi.fn()
  const onE = vi.fn()
  const view = render(<Shortcuts onJ={onJ} onE={onE} />)
  return { onJ, onE, view }
}

describe("useHotkeys", () => {
  afterEach(cleanup)

  it("runs the handler of a pressed key", () => {
    const { onJ, onE } = setup()

    fireEvent.keyDown(window, { key: "j" })

    expect(onJ).toHaveBeenCalledOnce()
    expect(onE).not.toHaveBeenCalled()
  })

  it("ignores typing, modifiers and open dialogs", () => {
    const { onE } = setup()

    fireEvent.keyDown(screen.getByLabelText("field"), { key: "e" })
    fireEvent.keyDown(window, { key: "e", ctrlKey: true })
    const dialog = document.body.appendChild(document.createElement("div"))
    dialog.setAttribute("role", "dialog")
    dialog.dataset.state = "open"
    fireEvent.keyDown(window, { key: "e" })
    dialog.remove()

    expect(onE).not.toHaveBeenCalled()
  })

  it("repeats only the keys that allow it", () => {
    const { onJ, onE } = setup()

    fireEvent.keyDown(window, { key: "j", repeat: true })
    fireEvent.keyDown(window, { key: "e", repeat: true })

    expect(onJ).toHaveBeenCalledOnce()
    expect(onE).not.toHaveBeenCalled()
  })

  it("uses the latest handlers without re-subscribing", () => {
    const { onE, view } = setup()
    const next = vi.fn()

    view.rerender(<Shortcuts onJ={next} onE={onE} />)
    fireEvent.keyDown(window, { key: "j" })

    expect(next).toHaveBeenCalledOnce()
  })
})
