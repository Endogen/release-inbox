"use client"

import { useSyncExternalStore } from "react"

import type { Platform } from "@/lib/releases"

function detect(): Platform | null {
  const agent = navigator as Navigator & { userAgentData?: { platform?: string } }
  const platform = (agent.userAgentData?.platform ?? navigator.userAgent).toLowerCase()
  // Phones have no desktop app; they get the generic download link.
  if (/android|iphone|ipad/.test(navigator.userAgent.toLowerCase())) return null
  if (platform.includes("win")) return "windows"
  if (platform.includes("mac")) return "macos"
  if (platform.includes("linux") || platform.includes("x11")) return "linux"
  return null
}

const subscribe = () => () => {}

/** The visitor's desktop platform; `null` while prerendering and on phones. */
export function usePlatform(): Platform | null {
  return useSyncExternalStore(subscribe, detect, () => null)
}
