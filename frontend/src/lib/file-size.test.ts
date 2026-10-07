import { describe, expect, it } from "vitest"

import { formatFileSize } from "./file-size"

describe("formatFileSize", () => {
  it("picks a readable unit", () => {
    expect(formatFileSize(512)).toBe("512 B")
    expect(formatFileSize(1536)).toBe("1.5 KB")
    expect(formatFileSize(48 * 1024 * 1024)).toBe("48 MB")
    expect(formatFileSize(1.25 * 1024 ** 3)).toBe("1.3 GB")
    expect(formatFileSize(1024 * 1024)).toBe("1 MB")
  })
})
