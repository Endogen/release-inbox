import type { ReactNode } from "react"

/** The layout of the policy pages: a title and readable prose. */
export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string
  updated: string
  children: ReactNode
}) {
  return (
    <article className="relative mx-auto max-w-3xl px-5 py-16 sm:px-8 sm:py-24">
      <div aria-hidden className="bg-aurora pointer-events-none absolute inset-x-0 -top-24 h-72 opacity-70" />
      <header className="relative mb-12">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">{title}</h1>
        <p className="mt-3 text-sm text-muted-foreground">Last updated {updated}</p>
      </header>
      <div className="relative space-y-5 leading-relaxed text-muted-foreground [&_a]:text-foreground [&_a]:underline [&_a]:underline-offset-4 [&_h2]:pt-6 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-foreground [&_li]:pl-1 [&_strong]:text-foreground [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5">
        {children}
      </div>
    </article>
  )
}
