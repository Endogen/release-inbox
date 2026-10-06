import { TriangleAlertIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"

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
    <Empty className={className}>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <TriangleAlertIcon />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button variant="outline" size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      </EmptyContent>
    </Empty>
  )
}
