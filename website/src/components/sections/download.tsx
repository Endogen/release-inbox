"use client"

import { ArrowDownToLineIcon, ArrowUpRightIcon, ShieldCheckIcon } from "lucide-react"
import Link from "next/link"

import { PLATFORM_ICONS } from "@/components/brand-icons"
import { Reveal } from "@/components/reveal"
import { Section } from "@/components/section"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { usePlatform } from "@/hooks/use-platform"
import { formatDate, formatSize } from "@/lib/format"
import { PLATFORMS } from "@/lib/platforms"
import type { LatestRelease } from "@/lib/releases"
import { site } from "@/lib/site"
import { cn } from "@/lib/utils"

export function Download({ release }: { release: LatestRelease | null }) {
  const detected = usePlatform()

  return (
    <Section
      id="download"
      eyebrow="Download"
      title="Get the desktop app"
      description={
        release ? (
          <>
            Version <span className="font-mono text-foreground">{release.version}</span>,
            released {formatDate(release.publishedAt)}. It connects to your own Releases server.
          </>
        ) : (
          "It connects to your own Releases server."
        )
      }
    >
      <div aria-hidden className="bg-aurora pointer-events-none absolute inset-0 opacity-60" />
      <div className="relative grid gap-4 md:grid-cols-3">
        {PLATFORMS.map((platform, index) => {
          const Icon = PLATFORM_ICONS[platform.id]
          const files = release?.downloads[platform.id] ?? []
          const isDetected = detected === platform.id
          return (
            <Reveal
              key={platform.id}
              delay={index * 90}
              className={cn(
                "edge-highlight flex flex-col rounded-2xl border bg-card/80 p-6 backdrop-blur transition-colors",
                isDetected && "border-brand/50 ring-4 ring-brand/10"
              )}
            >
              <div className="flex items-start justify-between">
                <Icon className="size-8" />
                {isDetected && <Badge variant="secondary">Your system</Badge>}
              </div>
              <h3 className="mt-5 text-lg font-semibold">{platform.name}</h3>
              <p className="text-sm text-muted-foreground">{platform.requirement}</p>

              <div className="mt-6 flex flex-1 flex-col justify-end gap-2">
                {files.length > 0 ? (
                  files.map((file, fileIndex) => (
                    <Button
                      key={file.name}
                      asChild
                      size="lg"
                      variant={fileIndex === 0 ? "default" : "outline"}
                      className="h-auto justify-between py-2.5"
                    >
                      <a href={file.url}>
                        <span className="flex items-center gap-2">
                          <ArrowDownToLineIcon />
                          {file.label}
                        </span>
                        <span
                          className={cn(
                            "font-mono text-xs",
                            fileIndex === 0 ? "text-primary-foreground/70" : "text-muted-foreground"
                          )}
                        >
                          {formatSize(file.size)}
                        </span>
                      </a>
                    </Button>
                  ))
                ) : (
                  <Button asChild size="lg" variant="outline">
                    <a href={site.releasesUrl}>
                      Releases on GitHub <ArrowUpRightIcon />
                    </a>
                  </Button>
                )}
              </div>
            </Reveal>
          )
        })}
      </div>

      <Reveal className="relative mt-8 flex flex-col items-center gap-3 text-center text-sm text-muted-foreground">
        <a
          href={release?.url ?? site.releasesUrl}
          className="inline-flex items-center gap-1 underline-offset-4 hover:text-foreground hover:underline"
        >
          Release notes and all files on GitHub <ArrowUpRightIcon className="size-3.5" />
        </a>
        <p className="flex max-w-xl items-start gap-2 text-pretty">
          <ShieldCheckIcon className="mt-0.5 size-4 shrink-0" />
          <span>
            {site.signing === "active"
              ? "Windows builds are signed through SignPath Foundation. "
              : "Code signing for Windows is being set up; until then Windows SmartScreen may warn before the first start. "}
            <Link href="/code-signing/" className="underline underline-offset-4 hover:text-foreground">
              Code signing policy
            </Link>
          </span>
        </p>
      </Reveal>
    </Section>
  )
}
