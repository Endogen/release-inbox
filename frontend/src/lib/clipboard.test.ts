// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest"

import { copyToClipboard } from "./clipboard"

describe("copyToClipboard", () => {
  it("writes the text", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal("navigator", { clipboard: { writeText } })

    await copyToClipboard("https://github.com/acme/app/releases/tag/v1.0.0")

    expect(writeText).toHaveBeenCalledWith("https://github.com/acme/app/releases/tag/v1.0.0")
  })

  it("explains why copying fails on insecure pages", async () => {
    vi.stubGlobal("navigator", {})

    await expect(copyToClipboard("x")).rejects.toThrow("secure (HTTPS) connection")
  })
})
