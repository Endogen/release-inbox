import { lazy, Suspense } from "react"

import { Skeleton } from "@/components/ui/skeleton"

import type { MarkdownProps } from "./markdown"

// The markdown pipeline is the largest dependency; it loads with the first markdown shown.
const Markdown = lazy(() => import("./markdown").then((module) => ({ default: module.Markdown })))

export function LazyMarkdown(props: MarkdownProps) {
  return (
    <Suspense fallback={<MarkdownSkeleton />}>
      <Markdown {...props} />
    </Suspense>
  )
}

export function MarkdownSkeleton() {
  return (
    <div role="status" aria-label="Loading" className="flex flex-col gap-3">
      <Skeleton className="h-6 w-1/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-11/12" />
      <Skeleton className="h-4 w-4/5" />
      <Skeleton className="mt-3 h-5 w-1/4" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-2/3" />
    </div>
  )
}
