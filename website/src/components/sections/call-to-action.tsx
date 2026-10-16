import { ServerIcon } from "lucide-react"

import { GitHubIcon } from "@/components/brand-icons"
import { DownloadButton } from "@/components/download-button"
import { LogoMark } from "@/components/logo"
import { Reveal } from "@/components/reveal"
import { Button } from "@/components/ui/button"
import type { LatestRelease } from "@/lib/releases"
import { site } from "@/lib/site"

export function CallToAction({ release }: { release: LatestRelease | null }) {
  return (
    <section className="px-5 pb-24 sm:px-8">
      <Reveal className="edge-highlight relative mx-auto max-w-6xl overflow-hidden rounded-3xl border bg-card px-6 py-16 text-center sm:py-20">
        <div aria-hidden className="bg-aurora absolute inset-0" />
        <div aria-hidden className="bg-dots absolute inset-0" />
        <div className="relative">
          <LogoMark className="mx-auto size-14 shadow-xl shadow-brand/30" />
          <h2 className="mx-auto mt-6 max-w-xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            Ready for a calmer inbox?
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-pretty text-muted-foreground">
            Set up your server in a few minutes, then follow every project you care about without
            the noise.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <DownloadButton release={release} />
            <Button size="xl" variant="outline" asChild>
              <a href="#self-host">
                <ServerIcon />
                Self-host it
              </a>
            </Button>
            <Button size="xl" variant="ghost" asChild>
              <a href={site.repositoryUrl}>
                <GitHubIcon />
                View on GitHub
              </a>
            </Button>
          </div>
        </div>
      </Reveal>
    </section>
  )
}
