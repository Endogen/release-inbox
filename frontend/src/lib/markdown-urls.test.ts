import { describe, expect, it } from "vitest"

import {
  anchorTarget,
  fileBaseUrls,
  repositoryBaseUrls,
  resolveSrcSet,
  resolveUrl,
} from "./markdown-urls"

const README = fileBaseUrls({
  html_url: "https://github.com/acme/app/blob/main/docs/README.md",
  download_url: "https://raw.githubusercontent.com/acme/app/main/docs/README.md?token=SECRET",
})

describe("resolveUrl", () => {
  it("resolves relative links and images against the file's directory", () => {
    expect(resolveUrl("./guide.md", "link", README)).toBe(
      "https://github.com/acme/app/blob/main/docs/guide.md"
    )
    expect(resolveUrl("../logo.png", "image", README)).toBe(
      "https://raw.githubusercontent.com/acme/app/main/logo.png?token=SECRET"
    )
  })

  it("keeps absolute URLs", () => {
    expect(resolveUrl("https://example.com/x.png", "image", README)).toBe(
      "https://example.com/x.png"
    )
    expect(resolveUrl("mailto:a@b.c", "link", README)).toBe("mailto:a@b.c")
  })

  it("maps in-page anchors to the prefixed ids", () => {
    expect(resolveUrl("#installation", "link", README)).toBe("#user-content-installation")
    expect(resolveUrl("#user-content-fn-1", "link", README)).toBe("#user-content-fn-1")
    expect(anchorTarget("#caf%C3%A9")).toBe("user-content-café")
  })

  it("leaves malformed URLs and anchors as they are", () => {
    // Backslashes count as slashes in http URLs, so this names an invalid host.
    expect(resolveUrl("/\\[invalid", "image", README)).toBe("/\\[invalid")
    expect(anchorTarget("#100%")).toBe("user-content-100%")
  })

  it("uses the repository root for release notes", () => {
    const bases = repositoryBaseUrls({
      html_url: "https://github.com/acme/app",
      full_name: "acme/app",
    })
    expect(resolveUrl("docs/x.md", "link", bases)).toBe(
      "https://github.com/acme/app/blob/HEAD/docs/x.md"
    )
  })
})

describe("resolveSrcSet", () => {
  it("resolves every candidate and keeps descriptors", () => {
    expect(resolveSrcSet("dark.png 1x, ./dark@2x.png 2x", README)).toBe(
      "https://raw.githubusercontent.com/acme/app/main/docs/dark.png?token=SECRET 1x, " +
        "https://raw.githubusercontent.com/acme/app/main/docs/dark@2x.png?token=SECRET 2x"
    )
  })
})
