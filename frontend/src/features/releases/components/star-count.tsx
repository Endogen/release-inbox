import { StarIcon } from "lucide-react"

import { formatCount } from "@/lib/format-count"

/** A repository's stars, compact like on GitHub (12.4k). */
export function StarCount({ count }: { count: number }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-0.5 tabular-nums">
      <StarIcon className="size-3" aria-hidden />
      {formatCount(count)}
      <span className="sr-only"> stars</span>
    </span>
  )
}
