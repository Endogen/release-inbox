import { describe, expect, it } from "vitest"

import { decodeBase64Url } from "./base64-url"

describe("decodeBase64Url", () => {
  it("decodes the URL-safe alphabet without padding", () => {
    // "-_-_" in base64url is "+/+/" in base64.
    expect([...decodeBase64Url("-_-_")]).toEqual([0xfb, 0xff, 0xbf])
    expect([...decodeBase64Url("aGk")]).toEqual([0x68, 0x69])
    expect([...decodeBase64Url("")]).toEqual([])
  })
})
