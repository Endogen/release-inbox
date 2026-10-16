"use client"

import { ArrowDownToLineIcon } from "lucide-react"

import { PLATFORM_ICONS } from "@/components/brand-icons"
import { Button } from "@/components/ui/button"
import { usePlatform } from "@/hooks/use-platform"
import { platformName } from "@/lib/platforms"
import type { LatestRelease } from "@/lib/releases"

/** Downloads the app for the visitor's platform, or jumps to all downloads. */
export function DownloadButton({ release }: { release: LatestRelease | null }) {
  const platform = usePlatform()
  const file = platform ? release?.downloads[platform][0] : undefined

  if (!platform || !file) {
    return (
      <Button size="xl" asChild>
        <a href="#download">
          <ArrowDownToLineIcon />
          Download the app
        </a>
      </Button>
    )
  }
  const Icon = PLATFORM_ICONS[platform]
  return (
    <Button size="xl" asChild>
      <a href={file.url}>
        <Icon />
        Download for {platformName(platform)}
      </a>
    </Button>
  )
}
