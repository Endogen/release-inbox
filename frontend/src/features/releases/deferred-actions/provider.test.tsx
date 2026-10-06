// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import type { ExternalToast } from "sonner"
import { useEffect } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { useDeferredActionQueue } from "./context"
import { DeferredActionsProvider } from "./provider"
import type { DeferredAction, DeferredActionQueue } from "./queue"

const toasts = vi.hoisted(() => new Map<string | number, ExternalToast>())

vi.mock("sonner", () => ({
  toast: Object.assign(
    (_message: string, options: ExternalToast) => {
      if (options.id !== undefined) toasts.set(options.id, options)
    },
    { dismiss: vi.fn(), error: vi.fn() }
  ),
}))

const ACTION: DeferredAction = {
  id: "read-1",
  repositoryId: 10,
  hideFrom: "inbox",
  path: "/releases/1/read",
  body: { include_older_in: "inbox" },
  message: "Marked as read",
  errorMessage: "Couldn't mark as read",
}

function setup() {
  const captured: { queue?: DeferredActionQueue } = {}
  function Capture() {
    const queue = useDeferredActionQueue()
    useEffect(() => {
      captured.queue = queue
    }, [queue])
    return null
  }
  render(
    <QueryClientProvider client={new QueryClient()}>
      <DeferredActionsProvider>
        <Capture />
      </DeferredActionsProvider>
    </QueryClientProvider>
  )
  const { queue } = captured
  if (!queue) throw new Error("The provider didn't render its children")
  queue.schedule(ACTION)
  const toast = toasts.get(ACTION.id)
  if (!toast) throw new Error("No toast for the scheduled action")
  return { queue, toast }
}

describe("DeferredActionsProvider", () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.useFakeTimers()
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal("fetch", fetchMock)
  })
  afterEach(() => {
    cleanup()
    toasts.clear()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it("undo from the toast never reaches the server", async () => {
    const { toast } = setup()

    const { action } = toast
    if (!action || typeof action !== "object" || !("onClick" in action)) {
      throw new Error("The toast offers no undo")
    }
    render(
      <button type="button" onClick={action.onClick}>
        {action.label}
      </button>
    )
    fireEvent.click(screen.getByRole("button", { name: "Undo" }))
    await vi.runAllTimersAsync()

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("dismissing the toast sends the action right away", async () => {
    const { toast } = setup()

    await act(async () => toast.onDismiss?.({ id: ACTION.id }))

    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe("/api/releases/1/read")
    expect(init.body).toBe('{"include_older_in":"inbox"}')
  })

  it("sends pending actions when the page is hidden", async () => {
    setup()

    await act(async () => window.dispatchEvent(new Event("pagehide")))

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit
    expect(init.keepalive).toBe(true)
  })
})
