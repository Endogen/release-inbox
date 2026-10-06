// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, cleanup, renderHook } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { authKeys } from "@/features/auth/api"
import { releaseKeys } from "@/features/releases/query-keys"
import { syncKeys } from "@/features/sync/api"
import type { SyncStatus } from "@/lib/api/types"

import { useLiveUpdates } from "./use-live-updates"

class FakeEventSource extends EventTarget {
  static readonly CLOSED = 2
  static instances: FakeEventSource[] = []
  readyState = 0

  constructor() {
    super()
    FakeEventSource.instances.push(this)
  }

  close() {
    this.readyState = FakeEventSource.CLOSED
  }

  emit(type: string, data?: string) {
    this.dispatchEvent(data === undefined ? new Event(type) : new MessageEvent(type, { data }))
  }

  /** The server answered with an error status: the browser gives up on this source. */
  fail() {
    this.readyState = FakeEventSource.CLOSED
    this.emit("error")
  }
}

const latest = () => FakeEventSource.instances.at(-1) as FakeEventSource

function setup() {
  const queryClient = new QueryClient()
  const invalidate = vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue()
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  const hook = renderHook(() => useLiveUpdates(true), { wrapper })
  const invalidated = (key: readonly unknown[]) =>
    invalidate.mock.calls.filter(([filters]) => filters?.queryKey === key).length
  return { queryClient, invalidated, hook }
}

describe("useLiveUpdates", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    FakeEventSource.instances = []
    vi.stubGlobal("EventSource", FakeEventSource)
  })
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it("refetches releases on changes and after reconnecting, not on the first connect", () => {
    const { invalidated } = setup()

    act(() => latest().emit("open"))
    expect(invalidated(releaseKeys.all)).toBe(0)

    act(() => latest().emit("releases-changed", "{}"))
    act(() => latest().emit("open"))
    expect(invalidated(releaseKeys.all)).toBe(2)
  })

  it("reopens a failed stream with growing delays and re-checks the session", () => {
    const { invalidated } = setup()

    act(() => latest().fail())
    expect(invalidated(authKeys.me)).toBe(1)
    act(() => vi.advanceTimersByTime(1999))
    expect(FakeEventSource.instances).toHaveLength(1)
    act(() => vi.advanceTimersByTime(1))
    expect(FakeEventSource.instances).toHaveLength(2)

    act(() => latest().fail())
    act(() => vi.advanceTimersByTime(3999))
    expect(FakeEventSource.instances).toHaveLength(2)
    act(() => vi.advanceTimersByTime(1))
    expect(FakeEventSource.instances).toHaveLength(3)
  })

  it("tracks sync progress and ignores malformed events", () => {
    const { queryClient } = setup()
    const status: SyncStatus = {
      last_synced_at: null,
      last_attempt_at: null,
      last_error: null,
      in_progress: false,
      rate_limited_until: null,
    }
    queryClient.setQueryData(syncKeys.status, status)

    act(() => latest().emit("sync-status", "not json"))
    act(() => latest().emit("sync-status", '{"in_progress": true}'))

    expect(queryClient.getQueryData<SyncStatus>(syncKeys.status)?.in_progress).toBe(true)
  })

  it("closes the stream on unmount", () => {
    const { hook } = setup()

    hook.unmount()

    expect(latest().readyState).toBe(FakeEventSource.CLOSED)
  })
})
