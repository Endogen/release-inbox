import { MenuIcon, StarIcon } from "lucide-react"
import Link from "next/link"

import { GitHubIcon } from "@/components/brand-icons"
import { LogoMark } from "@/components/logo"
import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { formatCount } from "@/lib/format"
import { getRepositoryStats } from "@/lib/releases"
import { site } from "@/lib/site"

export const NAVIGATION = [
  { href: "/#features", label: "Features" },
  { href: "/#desktop", label: "Desktop app" },
  { href: "/#download", label: "Download" },
  { href: "/#self-host", label: "Self-host" },
  { href: "/#faq", label: "FAQ" },
] as const

export async function SiteHeader() {
  const stats = await getRepositoryStats()
  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-5 sm:px-8">
        <Link href="/" className="flex items-center gap-2.5 font-semibold tracking-tight">
          <LogoMark />
          {site.name}
        </Link>
        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {NAVIGATION.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1.5">
          <Button variant="outline" size="sm" asChild className="hidden sm:inline-flex">
            <a href={site.repositoryUrl}>
              <GitHubIcon />
              GitHub
              {stats && stats.stars > 0 && (
                <span className="flex items-center gap-0.5 border-l pl-2 text-muted-foreground">
                  <StarIcon className="size-3" />
                  {formatCount(stats.stars)}
                </span>
              )}
            </a>
          </Button>
          <ThemeToggle />
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden" aria-label="Menu">
                <MenuIcon />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2.5">
                  <LogoMark className="size-6" />
                  {site.name}
                </SheetTitle>
              </SheetHeader>
              <nav aria-label="Main" className="flex flex-col gap-1 px-4">
                {NAVIGATION.map((item) => (
                  <SheetClose key={item.href} asChild>
                    <Link href={item.href} className="rounded-md px-3 py-2.5 text-sm hover:bg-muted">
                      {item.label}
                    </Link>
                  </SheetClose>
                ))}
                <a
                  href={site.repositoryUrl}
                  className="flex items-center gap-2 rounded-md px-3 py-2.5 text-sm hover:bg-muted"
                >
                  <GitHubIcon /> GitHub
                </a>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}
