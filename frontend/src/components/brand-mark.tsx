import { cn } from "cn"
import { RocketIcon } from "lucide-react"

export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm ring-1 ring-primary/20 [&_svg]:size-4",
        className
      )}
    >
      <RocketIcon />
    </span>
  )
}
