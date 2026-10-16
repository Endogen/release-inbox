import { ArrowRightIcon, ServerIcon } from "lucide-react"
import Image from "next/image"

import inboxDark from "@/assets/screenshots/inbox-dark.webp"
import whatsNewLight from "@/assets/screenshots/whats-new-light.webp"
import { DownloadButton } from "@/components/download-button"
import { Reveal } from "@/components/reveal"
import { Button } from "@/components/ui/button"
import type { LatestRelease } from "@/lib/releases"

export function Hero({ release }: { release: LatestRelease | null }) {
  return (
    <section className="relative overflow-hidden pt-16 sm:pt-24">
      <div aria-hidden className="bg-aurora pointer-events-none absolute inset-0 -top-40" />
      <div aria-hidden className="bg-dots pointer-events-none absolute inset-0" />

      <div className="relative mx-auto max-w-6xl px-5 text-center sm:px-8">
        <Reveal>
          {release && (
            <a
              href={release.url}
              className="group mb-8 inline-flex items-center gap-2 rounded-full border bg-background/60 py-1 pr-3 pl-1 text-sm backdrop-blur transition-colors hover:border-brand/40"
            >
              <span className="rounded-full bg-brand/15 px-2 py-0.5 font-mono text-xs font-medium text-brand">
                {release.version}
              </span>
              <span className="text-muted-foreground">The desktop app is here</span>
              <ArrowRightIcon className="size-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </a>
          )}
          <h1 className="mx-auto max-w-4xl text-5xl leading-[1.05] font-semibold tracking-tighter text-balance sm:text-6xl lg:text-7xl">
            <span className="block">Every release you watch.</span>
            <span className="text-gradient block">One calm inbox.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-pretty text-muted-foreground sm:text-xl">
            Releases collects the GitHub releases you&apos;re subscribed to: one entry per
            repository, the notes, what&apos;s new since your last visit, and the breaking
            changes up front. Triage it all in seconds.
          </p>
        </Reveal>

        <Reveal delay={120} className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <DownloadButton release={release} />
          <Button size="xl" variant="outline" asChild>
            <a href="#self-host">
              <ServerIcon />
              Self-host it
            </a>
          </Button>
        </Reveal>
        <Reveal delay={200}>
          <p className="mt-5 text-sm text-muted-foreground">
            Free · Your own server · Apps for Windows, macOS and Linux
          </p>
        </Reveal>
      </div>

      <Reveal delay={260} className="relative mx-auto mt-16 max-w-6xl px-5 sm:mt-20 sm:px-8">
        <div
          aria-hidden
          className="absolute inset-x-10 top-10 -bottom-10 rounded-[3rem] bg-brand/30 blur-3xl dark:bg-brand/25"
        />
        <div className="relative [perspective:2400px]">
          <div className="edge-highlight overflow-hidden rounded-2xl border bg-card shadow-2xl shadow-brand/10 [transform:rotateX(6deg)] transition-transform duration-700 hover:[transform:rotateX(0deg)] dark:shadow-black/50">
            <div className="flex items-center gap-2 border-b bg-muted/40 px-4 py-3">
              <span className="size-3 rounded-full bg-[#ff5f57]" />
              <span className="size-3 rounded-full bg-[#febc2e]" />
              <span className="size-3 rounded-full bg-[#28c840]" />
              <span className="mx-auto truncate rounded-md bg-background/70 px-3 py-0.5 font-mono text-[11px] whitespace-nowrap text-muted-foreground sm:text-xs">
                releases.your-server.dev/inbox
              </span>
              <span className="w-12" />
            </div>
            <Image
              src={inboxDark}
              alt="The inbox in the dark theme: one entry per repository, the selected release with its notes"
              priority
              sizes="(min-width: 1200px) 1150px, 100vw"
              className="hidden w-full dark:block"
            />
            <Image
              src={whatsNewLight}
              alt="What's new in the light theme: the notes of every unread release of a repository"
              priority
              sizes="(min-width: 1200px) 1150px, 100vw"
              className="w-full dark:hidden"
            />
          </div>
        </div>
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -bottom-px h-40 bg-gradient-to-t from-background to-transparent"
        />
      </Reveal>
    </section>
  )
}
