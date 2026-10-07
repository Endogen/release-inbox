import { describe, expect, it } from "vitest"

import type { ReleaseAsset } from "@/lib/api/types"

import {
  assetForDevice,
  classifyAsset,
  detectPlatform,
  sortAssets,
  sourceArchives,
} from "./release-assets"

function asset(name: string, id = 1): ReleaseAsset {
  return { id, name, size: 1, download_count: 0, url: `https://x.test/${name}`, content_type: null }
}

const classify = (name: string) => {
  const { platform, arch, kind } = classifyAsset(asset(name))
  return { platform, arch, kind }
}

describe("classifyAsset", () => {
  it("recognises platforms, architectures and kinds from file names", () => {
    expect(classify("app-2.3.3-arm64.apk")).toEqual({
      platform: "android",
      arch: "arm64",
      kind: "installer",
    })
    expect(classify("App-2.3.3-universal.dmg")).toEqual({
      platform: "macos",
      arch: "universal",
      kind: "installer",
    })
    expect(classify("tool_Windows_x86_64.zip")).toEqual({
      platform: "windows",
      arch: "x64",
      kind: "archive",
    })
    expect(classify("tool-aarch64-unknown-linux-musl.tar.gz")).toEqual({
      platform: "linux",
      arch: "arm64",
      kind: "archive",
    })
    expect(classify("checksums.txt").kind).toBe("verification")
    expect(classify("app.tar.gz.sha256").kind).toBe("verification")
  })

  it("doesn't mistake darwin for Windows", () => {
    expect(classify("tool-darwin-amd64.tar.gz").platform).toBe("macos")
  })
})

describe("assetForDevice", () => {
  const files = [
    "app-linux-x64.AppImage",
    "app-mac-x64.dmg",
    "app-mac-arm64.dmg",
    "app-win-x64-setup.exe",
    "app-win-x64-setup.exe.sig",
  ].map((name, index) => classifyAsset(asset(name, index)))

  it("prefers the usual architecture of the platform", () => {
    expect(assetForDevice(files, "macos")?.asset.name).toBe("app-mac-arm64.dmg")
    expect(assetForDevice(files, "windows")?.asset.name).toBe("app-win-x64-setup.exe")
    expect(assetForDevice(files, "linux")?.asset.name).toBe("app-linux-x64.AppImage")
  })

  it("suggests nothing without a matching file", () => {
    expect(assetForDevice(files, "android")).toBeUndefined()
    expect(assetForDevice(files, null)).toBeUndefined()
  })
})

describe("detectPlatform", () => {
  it("reads the user agent", () => {
    expect(detectPlatform("Mozilla/5.0 (Linux; Android 14; Pixel 7)")).toBe("android")
    expect(detectPlatform("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)")).toBe("ios")
    expect(detectPlatform("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)")).toBe("macos")
    expect(detectPlatform("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")).toBe("windows")
    expect(detectPlatform("Mozilla/5.0 (X11; Linux x86_64)")).toBe("linux")
  })
})

describe("sortAssets", () => {
  it("moves checksums and signatures to the end", () => {
    const sorted = sortAssets(
      ["SHA256SUMS", "app.exe", "app.exe.asc", "app.zip"].map((name) => classifyAsset(asset(name)))
    )
    expect(sorted.map((item) => item.asset.name)).toEqual([
      "app.exe",
      "app.zip",
      "SHA256SUMS",
      "app.exe.asc",
    ])
  })
})

describe("sourceArchives", () => {
  it("links GitHub's archives of the tag", () => {
    expect(sourceArchives("https://github.com/acme/app", "web@1.0.0")[0]?.url).toBe(
      "https://github.com/acme/app/archive/refs/tags/web%401.0.0.zip"
    )
  })
})
