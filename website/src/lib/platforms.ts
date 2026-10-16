import type { Platform } from "./releases"

export const PLATFORMS: ReadonlyArray<{ id: Platform; name: string; requirement: string }> = [
  { id: "windows", name: "Windows", requirement: "Windows 10 and 11, 64-bit" },
  { id: "macos", name: "macOS", requirement: "One app for Apple silicon and Intel" },
  { id: "linux", name: "Linux", requirement: "64-bit (x86_64) distributions" },
]

export function platformName(platform: Platform): string {
  return PLATFORMS.find(({ id }) => id === platform)?.name ?? platform
}
