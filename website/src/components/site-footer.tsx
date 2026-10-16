import Link from "next/link"

import { LogoMark } from "@/components/logo"
import { site } from "@/lib/site"

const COLUMNS = [
  {
    title: "Product",
    links: [
      { href: "/#features", label: "Features" },
      { href: "/#desktop", label: "Desktop app" },
      { href: "/#download", label: "Download" },
      { href: "/#self-host", label: "Self-host" },
    ],
  },
  {
    title: "Project",
    links: [
      { href: site.repositoryUrl, label: "Source code" },
      { href: site.releasesUrl, label: "All releases" },
      { href: site.issuesUrl, label: "Report an issue" },
      { href: site.readmeUrl, label: "Documentation" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/code-signing/", label: "Code signing policy" },
      { href: "/privacy/", label: "Privacy policy" },
    ],
  },
] as const

export function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 sm:px-8 md:grid-cols-[1.5fr_repeat(3,1fr)]">
        <div className="max-w-xs">
          <Link href="/" className="flex items-center gap-2.5 font-semibold tracking-tight">
            <LogoMark className="size-6" />
            {site.name}
          </Link>
          <p className="mt-3 text-sm text-muted-foreground">
            A calm inbox for the GitHub releases you watch. Self-hosted, made by{" "}
            <a href={site.maintainer.url} className="underline-offset-4 hover:underline">
              {site.maintainer.name}
            </a>
            .
          </p>
        </div>
        {COLUMNS.map((column) => (
          <div key={column.title}>
            <p className="text-sm font-medium">{column.title}</p>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              {column.links.map((link) => (
                <li key={link.href}>
                  {link.href.startsWith("/") ? (
                    <Link href={link.href} className="transition-colors hover:text-foreground">
                      {link.label}
                    </Link>
                  ) : (
                    <a href={link.href} className="transition-colors hover:text-foreground">
                      {link.label}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t">
        <p className="mx-auto max-w-6xl px-5 py-6 text-xs text-muted-foreground sm:px-8">
          Releases is not affiliated with GitHub. GitHub is a trademark of GitHub, Inc.
        </p>
      </div>
    </footer>
  )
}
