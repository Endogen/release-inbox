/**
 * The newest release and its files, read from the GitHub API once, at build time. The deploy
 * workflow rebuilds the site whenever a release is published, so the links stay current.
 * Without network access the site still builds and links to the releases page instead.
 */
import { site } from "./site"

export type Platform = "windows" | "macos" | "linux"

export interface Download {
  name: string
  url: string
  size: number
  /** What the file is, e.g. "Installer (.exe)". */
  label: string
}

export interface LatestRelease {
  version: string
  url: string
  publishedAt: string
  downloads: Record<Platform, Download[]>
}

export interface RepositoryStats {
  stars: number
}

interface GitHubAsset {
  name: string
  size: number
  browser_download_url: string
}

/** The files offered per platform, in the order they are listed. */
const KINDS: ReadonlyArray<{ platform: Platform; suffix: string; label: string }> = [
  { platform: "windows", suffix: "-setup.exe", label: "Installer (.exe)" },
  { platform: "windows", suffix: ".msi", label: "MSI package" },
  { platform: "macos", suffix: ".dmg", label: "Disk image (.dmg)" },
  { platform: "linux", suffix: ".AppImage", label: "AppImage" },
  { platform: "linux", suffix: ".deb", label: "Debian, Ubuntu (.deb)" },
  { platform: "linux", suffix: ".rpm", label: "Fedora, openSUSE (.rpm)" },
]

async function github<T>(path: string): Promise<T | null> {
  const token = process.env.GITHUB_TOKEN
  try {
    const response = await fetch(`https://api.github.com/repos/${site.repository}${path}`, {
      headers: {
        Accept: "application/vnd.github+json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    })
    return response.ok ? ((await response.json()) as T) : null
  } catch {
    return null
  }
}

export async function getLatestRelease(): Promise<LatestRelease | null> {
  const release = await github<{
    tag_name: string
    html_url: string
    published_at: string
    assets: GitHubAsset[]
  }>("/releases/latest")
  if (!release) return null

  const downloads: Record<Platform, Download[]> = { windows: [], macos: [], linux: [] }
  for (const { platform, suffix, label } of KINDS) {
    const asset = release.assets.find((asset) => asset.name.endsWith(suffix))
    if (asset) {
      downloads[platform].push({
        name: asset.name,
        url: asset.browser_download_url,
        size: asset.size,
        label,
      })
    }
  }
  return {
    version: release.tag_name,
    url: release.html_url,
    publishedAt: release.published_at,
    downloads,
  }
}

export async function getRepositoryStats(): Promise<RepositoryStats | null> {
  const repository = await github<{ stargazers_count: number }>("")
  return repository ? { stars: repository.stargazers_count } : null
}
