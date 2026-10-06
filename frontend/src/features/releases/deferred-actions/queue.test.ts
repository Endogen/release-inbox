import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { DeferredActionQueue, hiddenRepositories, type DeferredAction } from "./queue"

const ACTION: DeferredAction = {
  id: "read-10",
  repositoryId: 10,
  hideFrom: "inbox",
  path: "/releases/1/read",
  message: "Marked as read",
  errorMessage: "Couldn't mark as read",
}

function setup(commit = vi.fn().mockResolvedValue(undefined)) {
  const onSettled = vi.fn()
  const onError = vi.fn()
  const queue = new DeferredActionQueue({ commit, onSettled, onError }, 1000)
  return { queue, commit, onSettled, onError }
}

describe("DeferredActionQueue", () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it("commits after the undo window and keeps the action pending until confirmed", async () => {
    let confirm: () => void = () => {}
    const { queue, commit } = setup(
      vi.fn(() => new Promise<void>((resolve) => (confirm = resolve)))
    )

    queue.schedule(ACTION)
    await vi.advanceTimersByTimeAsync(999)
    expect(commit).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)
    expect(commit).toHaveBeenCalledWith(ACTION, { keepalive: false })
    expect(queue.getSnapshot()).toEqual([ACTION])

    confirm()
    await vi.runAllTimersAsync()
    expect(queue.getSnapshot()).toEqual([])
  })

  it("undoing never reaches the server", async () => {
    const { queue, commit, onSettled } = setup()

    queue.schedule(ACTION)
    expect(queue.undo(ACTION.id)).toBe(true)
    await vi.runAllTimersAsync()

    expect(commit).not.toHaveBeenCalled()
    expect(onSettled).toHaveBeenCalledWith(ACTION)
    expect(queue.getSnapshot()).toEqual([])
  })

  it("ignores duplicates and undo after sending", async () => {
    const { queue, commit } = setup()

    expect(queue.schedule(ACTION)).toBe(true)
    expect(queue.schedule(ACTION)).toBe(false)
    await vi.advanceTimersByTimeAsync(1000)

    expect(queue.undo(ACTION.id)).toBe(false)
    expect(commit).toHaveBeenCalledTimes(1)
  })

  it("flushes everything at once, for example when the page is hidden", async () => {
    const { queue, commit } = setup()
    const other = { ...ACTION, id: "unsubscribe-20", repositoryId: 20 }

    queue.schedule(ACTION)
    queue.schedule(other)
    await queue.flush({ keepalive: true })

    expect(commit.mock.calls).toEqual([
      [ACTION, { keepalive: true }],
      [other, { keepalive: true }],
    ])
    expect(queue.getSnapshot()).toEqual([])
    await vi.runAllTimersAsync()
    expect(commit).toHaveBeenCalledTimes(2)
  })

  it("reports failures and releases the action", async () => {
    const error = new Error("offline")
    const { queue, onError } = setup(vi.fn().mockRejectedValue(error))

    queue.schedule(ACTION)
    await queue.commit(ACTION.id)

    expect(onError).toHaveBeenCalledWith(ACTION, error)
    expect(queue.getSnapshot()).toEqual([])
  })

  it("notifies subscribers", () => {
    const { queue } = setup()
    const listener = vi.fn()
    const unsubscribe = queue.subscribe(listener)

    queue.schedule(ACTION)
    queue.undo(ACTION.id)
    unsubscribe()
    queue.schedule(ACTION)

    expect(listener).toHaveBeenCalledTimes(2)
  })
})

describe("hiddenRepositories", () => {
  it("collects the repositories hidden from a view", () => {
    const actions = [ACTION, { ...ACTION, id: "x", repositoryId: 11, hideFrom: null }]
    expect([...hiddenRepositories(actions, "inbox")]).toEqual([10])
    expect([...hiddenRepositories(actions, "read")]).toEqual([])
  })
})
