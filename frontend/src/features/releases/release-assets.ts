import type { ReleaseAsset } from "@/lib/api/types"

export type Platform = "windows" | "macos" | "linux" | "android" | "ios"
type Arch = "arm64" | "x64" | "universal" | "x86" | "arm"
type Kind = "installer" | "archive" | "verification" | "other"

export interface ClassifiedAsset {
  asset: ReleaseAsset
  platform: Platform | null
  arch: Arch | null
  kind: Kind
}

export const PLATFORM_LABELS: Record<Platform, string> = {
  windows: "Windows",
  macos: "macOS",
  linux: "Linux",
  android: "Android",
  ios: "iOS",
}

// Names are matched in lower case. Word parts are delimited by anything but a letter, so that
// "darwin" doesn't count as "win".
const PLATFORM_PATTERNS: ReadonlyArray<[Platform, RegExp]> = [
  ["android", /(^|[^a-z])android([^a-z]|$)|\.(apk|aab)$/],
  ["ios", /(^|[^a-z])ios([^a-z]|$)|\.ipa$/],
  ["macos", /(^|[^a-z])(mac|macos|osx|darwin|apple)([^a-z]|$)|\.(dmg|pkg)$/],
  ["windows", /(^|[^a-z])(windows|win|win32|win64)([^a-z]|$)|\.(exe|msi|msix|appx)$/],
  ["linux", /(^|[^a-z])(linux|musl|gnu|appimage)([^a-z]|$)|\.(deb|rpm|snap|flatpak|appimage)$/],
]

const ARCH_PATTERNS: ReadonlyArray<[Arch, RegExp]> = [
  ["universal", /universal/],
  ["arm64", /arm64|aarch64|armv8/],
  ["x64", /x86[-_]?64|amd64|x64|win64/],
  ["arm", /armv7|armhf|(^|[^a-z0-9])arm([^a-z0-9]|$)/],
  ["x86", /i[3-6]86|(^|[^a-z0-9])(x86|386|win32)([^a-z0-9]|$)/],
]

/** Checksums, signatures and attestations: useful, but not what most people download. */
const VERIFICATION =
  /(checksums?|sha\d*sums?)(\.txt)?$|\.(sha1|sha256|sha512|md5|asc|sig|minisig|pem|crt|sbom|intoto\.jsonl)$|\.spdx(\.json)?$/
const INSTALLER =
  /\.(exe|msi|msix|appx|dmg|pkg|deb|rpm|snap|flatpak|appimage|apk|aab|ipa|vsix|whl)$/
const ARCHIVE = /\.(zip|7z|rar|tar|tgz|tar\.gz|tar\.xz|tar\.bz2|tar\.zst|gz|xz|bz2|zst)$/

export function classifyAsset(asset: ReleaseAsset): ClassifiedAsset {
  const name = asset.name.toLowerCase()
  const kind: Kind = VERIFICATION.test(name)
    ? "verification"
    : INSTALLER.test(name)
      ? "installer"
      : ARCHIVE.test(name)
        ? "archive"
        : "other"
  const platform = PLATFORM_PATTERNS.find(([, pattern]) => pattern.test(name))?.[0] ?? null
  const arch = ARCH_PATTERNS.find(([, pattern]) => pattern.test(name))?.[0] ?? null
  return { asset, platform, arch, kind }
}

/** Architectures in order of preference, for when the device's own can't be detected. */
const PREFERRED_ARCH: Record<Platform, readonly (Arch | null)[]> = {
  // Most Macs and Android phones in use run on ARM; Windows and Linux PCs mostly on x64.
  macos: ["universal", "arm64", null, "x64"],
  android: ["universal", "arm64", null, "arm", "x64", "x86"],
  ios: [null, "universal", "arm64"],
  windows: ["x64", null, "universal", "x86", "arm64"],
  linux: ["x64", null, "universal", "arm64", "arm", "x86"],
}

/** The file most likely meant for a device running ``platform``, if any. */
export function assetForDevice(
  assets: readonly ClassifiedAsset[],
  platform: Platform | null
): ClassifiedAsset | undefined {
  if (platform === null) return undefined
  const preference = PREFERRED_ARCH[platform]
  const rank = (item: ClassifiedAsset) => {
    const index = preference.indexOf(item.arch)
    return index === -1 ? preference.length : index
  }
  const candidates = assets.filter(
    (item) => item.platform === platform && item.kind !== "verification"
  )
  // Stable: among equally good matches, the release's own order wins.
  return candidates.toSorted((a, b) => rank(a) - rank(b))[0]
}

/** The platform of this device, from the browser's user agent. */
export function detectPlatform(userAgent: string): Platform | null {
  if (/android/i.test(userAgent)) return "android"
  if (/iphone|ipad|ipod/i.test(userAgent)) return "ios"
  if (/mac os x|macintosh/i.test(userAgent)) return "macos"
  if (/windows/i.test(userAgent)) return "windows"
  if (/linux|x11|cros/i.test(userAgent)) return "linux"
  return null
}

/** Downloads first, checksums and signatures last; otherwise in the release's order. */
export function sortAssets(assets: readonly ClassifiedAsset[]): ClassifiedAsset[] {
  return assets.toSorted(
    (a, b) => Number(a.kind === "verification") - Number(b.kind === "verification")
  )
}

/** The archives GitHub offers for every tag, alongside the uploaded files. */
export function sourceArchives(repositoryUrl: string, tag: string) {
  const base = `${repositoryUrl}/archive/refs/tags/${encodeURIComponent(tag)}`
  return [
    { label: "Source code (zip)", url: `${base}.zip` },
    { label: "Source code (tar.gz)", url: `${base}.tar.gz` },
  ]
}
