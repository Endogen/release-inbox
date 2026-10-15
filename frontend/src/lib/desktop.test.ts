import { describe, expect, it } from "vitest"

import { isDesktop, readDesktopNotification } from "./desktop"

describe("readDesktopNotification", () => {
  it("reads notifications and ignores malformed events", () => {
    const notification = { title: "acme/app", body: "v1 was released", url: "/inbox?release=1" }

    expect(readDesktopNotification(JSON.stringify(notification))).toEqual(notification)
    expect(readDesktopNotification("not json")).toBeUndefined()
    expect(readDesktopNotification('{"title": "acme/app"}')).toBeUndefined()
    expect(readDesktopNotification("null")).toBeUndefined()
  })
})

describe("isDesktop", () => {
  it("is false in a browser", () => {
    expect(isDesktop()).toBe(false)
  })
})
