// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest"

import { readStorage, writeStorage } from "./storage"

describe("storage", () => {
  it("works without storage, as when the browser blocks it", () => {
    const blocked = () => {
      throw new DOMException("The operation is insecure.", "SecurityError")
    }
    vi.stubGlobal("localStorage", { getItem: blocked, setItem: blocked })

    expect(readStorage("key")).toBeNull()
    expect(() => writeStorage("key", "value")).not.toThrow()
  })

  it("reads what it wrote", () => {
    writeStorage("key", "value")
    expect(readStorage("key")).toBe("value")
  })
})
