import { afterEach, describe, expect, it, vi } from "vitest"

import { api, ApiError } from "./client"

function respond(response: Response) {
  const fetchMock = vi.fn().mockResolvedValue(response)
  vi.stubGlobal("fetch", fetchMock)
  return fetchMock
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

async function failure(request: Promise<unknown>): Promise<ApiError> {
  const error = await request.catch((caught: unknown) => caught)
  if (!(error instanceof ApiError)) throw new Error("Expected an ApiError")
  return error
}

describe("api", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("builds the query, repeating arrays and leaving out empty values", async () => {
    const fetchMock = respond(json(200, {}))

    await api.get("/summaries", { query: { release_ids: [1, 2], q: "", limit: 5, x: null } })

    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/summaries?release_ids=1&release_ids=2&limit=5")
  })

  it("sends JSON bodies and returns nothing for 204", async () => {
    const fetchMock = respond(new Response(null, { status: 204 }))

    const result = await api.post("/releases/1/read", { include_older_in: "inbox" })

    expect(result).toBeUndefined()
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit
    expect(init.method).toBe("POST")
    expect(init.body).toBe('{"include_older_in":"inbox"}')
    expect(init.headers).toEqual({ "Content-Type": "application/json" })
  })

  it("reports the server's message", async () => {
    respond(json(409, { detail: "Only unread releases can be snoozed" }))

    const error = await failure(api.post("/releases/1/snooze", {}))

    expect(error.status).toBe(409)
    expect(error.message).toBe("Only unread releases can be snoozed")
  })

  it("joins validation messages", async () => {
    respond(
      json(422, {
        detail: [
          { loc: ["body", "until"], msg: "Value error, must be in the future" },
          { loc: ["body", "view"], msg: "Input should be 'inbox'" },
        ],
      })
    )

    const error = await failure(api.post("/releases/1/snooze", {}))

    expect(error.message).toBe("Value error, must be in the future. Input should be 'inbox'")
  })

  it("falls back to the status for other errors", async () => {
    respond(new Response("<html>Bad gateway</html>", { status: 502, statusText: "Bad Gateway" }))

    const error = await failure(api.get("/releases"))

    expect(error.message).toBe("Bad Gateway")
    expect(error.isUnauthorized).toBe(false)
  })
})
