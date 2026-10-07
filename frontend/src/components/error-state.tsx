import { TriangleAlertIcon } from "lucide-react"

import { EmptyState } from "@/components/empty-state"
import { Button } from "@/components/ui/button"

interface ErrorStateProps {
  title: string
  description: string
  actionLabel?: string
  onAction: () => void
  className?: string
}

/** A failure that replaces a whole area, with a way to try again. */
export function ErrorState({
  title,
  description,
  actionLabel = "Try again",
  onAction,
  className,
}: ErrorStateProps) {
  return (
    <EmptyState
      icon={TriangleAlertIcon}
      title={title}
      description={description}
      className={className}
    >
      <Button variant="outline" size="sm" onClick={onAction}>
        {actionLabel}
      </Button>
    </EmptyState>
  )
}
