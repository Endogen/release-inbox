import { afterEach, describe, expect, it, vi } from "vitest"

import { onDesktopEvent, setDesktopUnreadCount } from "./desktop"

const tauri = vi.hoisted(() => ({
  invoke: vi.fn(),
  listen: vi.fn(),
}))

vi.mock("@tauri-apps/api/core", () => ({ invoke: tauri.invoke, isTauri: () => true }))
vi.mock("@tauri-apps/api/event", () => ({ listen: tauri.listen }))

/** A ``listen`` that starts listening once ``start`` is called. */
function deferredListen() {
  const stop = vi.fn()
  let start = () => {}
  tauri.listen.mockImplementation(
    (_event: string, handler: (event: { payload: unknown }) => void) =>
      new Promise((resolve) => {
        start = () => {
          resolve(stop)
          handler({ payload: "/inbox?release=1" })
        }
      })
  )
  return { stop, start: () => start() }
}

describe("onDesktopEvent", () => {
  afterEach(() => vi.resetAllMocks())

  it("passes the payloads on and stops listening", async () => {
    const { stop, start } = deferredListen()
    const handler = vi.fn()

    const unsubscribe = onDesktopEvent("desktop://navigate", handler)
    start()
    await vi.waitFor(() => expect(handler).toHaveBeenCalledWith("/inbox?release=1"))
    unsubscribe()

    expect(stop).toHaveBeenCalledOnce()
  })

  it("stops listening when it was stopped before listening started", async () => {
    const { stop, start } = deferredListen()

    const unsubscribe = onDesktopEvent("desktop://sync", vi.fn())
    unsubscribe()
    start()

    await vi.waitFor(() => expect(stop).toHaveBeenCalledOnce())
  })
})

describe("calls to the desktop", () => {
  afterEach(() => vi.restoreAllMocks())

  it("log failures instead of failing", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    tauri.invoke.mockRejectedValue("set_unread_count not allowed")

    await expect(setDesktopUnreadCount(2)).resolves.toBeUndefined()

    expect(tauri.invoke).toHaveBeenCalledWith("set_unread_count", { count: 2 })
    expect(warn).toHaveBeenCalledOnce()
  })
})
