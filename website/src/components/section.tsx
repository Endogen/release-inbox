import type { ReactNode } from "react"

import { Reveal } from "@/components/reveal"
import { cn } from "@/lib/utils"

/** A page section with an anchor and an optional centred heading. */
export function Section({
  id,
  eyebrow,
  title,
  description,
  className,
  children,
}: {
  id?: string
  eyebrow?: string
  title?: ReactNode
  description?: ReactNode
  className?: string
  children: ReactNode
}) {
  return (
    <section id={id} className={cn("relative py-20 sm:py-28", className)}>
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        {title && (
          <Reveal className="mx-auto mb-12 max-w-2xl text-center sm:mb-16">
            {eyebrow && (
              <p className="mb-3 font-mono text-xs font-medium tracking-widest text-brand uppercase">
                {eyebrow}
              </p>
            )}
            <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              {title}
            </h2>
            {description && (
              <p className="mt-4 text-base text-pretty text-muted-foreground sm:text-lg">
                {description}
              </p>
            )}
          </Reveal>
        )}
        {children}
      </div>
    </section>
  )
}
