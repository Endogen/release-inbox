// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, cleanup, renderHook } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { DesktopAction } from "@/lib/desktop"

import { useNotificationActions } from "./use-notification-actions"

const mocks = vi.hoisted(() => ({
  showDesktopNotification: vi.fn().mockResolvedValue(undefined),
  toastWithUndo: vi.fn(),
}))

vi.mock("@/lib/desktop", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/desktop")>()),
  showDesktopNotification: mocks.showDesktopNotification,
}))

vi.mock("@/lib/toasts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/toasts")>()),
  toastWithUndo: mocks.toastWithUndo,
}))

const fetchMock = vi.fn()

function run(action: Partial<DesktopAction>) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
  )
  const { result } = renderHook(() => useNotificationActions(), { wrapper })
  return act(async () => {
    result.current({
      action: "mark-read",
      release_ids: [1, 2],
      repository_id: 10,
      title: "acme/app",
      ...action,
    })
    await vi.waitFor(() => expect(mocks.toastWithUndo.mock.calls.length > 0 || failed()).toBe(true))
  })
}

const failed = () => mocks.showDesktopNotification.mock.calls.length > 0

/** The requests sent, as ``METHOD path body``. */
function requests(): string[] {
  return (fetchMock.mock.calls as [string, RequestInit][]).map(([url, init]) =>
    [init.method ?? "GET", url, init.body].filter(Boolean).join(" ")
  )
}

/** Clicks "Undo" on the toast and returns the requests that sent. */
async function undo(): Promise<string[]> {
  const [, { onUndo }] = mocks.toastWithUndo.mock.calls[0] as [string, { onUndo: () => void }]
  fetchMock.mockClear()
  await act(async () => onUndo())
  await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled())
  return requests()
}

describe("useNotificationActions", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockImplementation(() => Promise.resolve(new Response(null, { status: 204 })))
    vi.stubGlobal("fetch", fetchMock)
    mocks.toastWithUndo.mockClear()
    mocks.showDesktopNotification.mockClear()
  })
  afterEach(cleanup)

  it("marks exactly the notified releases as read, and back", async () => {
    await run({ action: "mark-read" })

    expect(requests()).toEqual([
      'POST /api/releases/1/read {"include_older_in":null,"search":null}',
      'POST /api/releases/2/read {"include_older_in":null,"search":null}',
    ])
    expect(mocks.toastWithUndo).toHaveBeenCalledWith("Marked 2 releases as read", {
      description: "acme/app",
      onUndo: expect.any(Function),
    })
    expect(await undo()).toEqual(["POST /api/releases/1/unread", "POST /api/releases/2/unread"])
  })

  it("snoozes until tomorrow morning", async () => {
    await run({ action: "snooze", release_ids: [1] })

    const [request] = requests()
    const body = JSON.parse(request?.split(" ").slice(2).join(" ") ?? "{}") as {
      until: string
      view: unknown
    }
    expect(request).toMatch(/^POST \/api\/releases\/1\/snooze /)
    expect(body.view).toBeNull()
    const until = new Date(body.until)
    expect(until.getHours()).toBe(9)
    expect(until.getTime()).toBeGreaterThan(Date.now())
    expect(mocks.toastWithUndo.mock.calls[0]?.[0]).toMatch(/^Snoozed until /)
    expect(await undo()).toEqual(["DELETE /api/releases/1/snooze?include_group=false"])
  })

  it("mutes the repository", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(Response.json({ id: 10 })))
    await run({ action: "mute" })

    expect(requests()).toEqual(['PUT /api/repositories/10/notifications {"enabled":false}'])
    expect(await undo()).toEqual(['PUT /api/repositories/10/notifications {"enabled":true}'])
  })

  it("reports a failure as a notification while the app is in the tray", async () => {
    vi.spyOn(document, "hasFocus").mockReturnValue(false)
    fetchMock.mockImplementation(() =>
      Promise.resolve(
        Response.json({ detail: "Only unread releases can be snoozed" }, { status: 409 })
      )
    )
    await run({ action: "snooze", release_ids: [1] })

    expect(mocks.toastWithUndo).not.toHaveBeenCalled()
    expect(mocks.showDesktopNotification).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Couldn't snooze", release_ids: [] })
    )
  })
})
