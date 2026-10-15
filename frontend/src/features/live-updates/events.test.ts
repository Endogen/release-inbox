import { describe, expect, it } from "vitest"

import { readInProgress, readNotification } from "./events"

describe("readInProgress", () => {
  it("reads the flag and ignores malformed events", () => {
    expect(readInProgress('{"in_progress": true}')).toBe(true)
    expect(readInProgress('{"in_progress": "yes"}')).toBeUndefined()
    expect(readInProgress("not json")).toBeUndefined()
  })
})

describe("readNotification", () => {
  it("keeps the fields the desktop uses", () => {
    const event = {
      title: "acme/app",
      body: "v1 was released",
      url: "/inbox?release=1",
      tag: "release-1",
      unread: 3,
      release_ids: [1],
      repository_id: 10,
    }

    expect(readNotification(JSON.stringify(event))).toEqual({
      title: "acme/app",
      body: "v1 was released",
      url: "/inbox?release=1",
      release_ids: [1],
      repository_id: 10,
    })
  })

  it("reads notifications without releases, such as the test notification", () => {
    expect(readNotification('{"title": "On", "body": "Test", "url": "/inbox"}')).toEqual({
      title: "On",
      body: "Test",
      url: "/inbox",
      release_ids: [],
      repository_id: null,
    })
  })

  it("ignores malformed events", () => {
    const valid = { title: "acme/app", body: "v1", url: "/inbox" }
    for (const event of [
      "not json",
      "null",
      "[]",
      JSON.stringify({ title: "acme/app" }),
      JSON.stringify({ ...valid, title: 1 }),
      JSON.stringify({ ...valid, release_ids: ["1"] }),
      JSON.stringify({ ...valid, repository_id: "10" }),
    ]) {
      expect(readNotification(event), event).toBeUndefined()
    }
  })
})
