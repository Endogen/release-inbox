import type { UseQueryResult } from "@tanstack/react-query"
import { cn } from "cn"
import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"

import { RepoAvatar } from "@/components/avatars"
import { EmptyState } from "@/components/empty-state"
import { ErrorState } from "@/components/error-state"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import { Skeleton } from "@/components/ui/skeleton"
import type { Repository } from "@/lib/api/types"

interface RepositoryListProps<T> {
  query: UseQueryResult<T[]>
  /** What failed to load, e.g. "Couldn't load muted repositories". */
  errorTitle: string
  empty: { icon: LucideIcon; title: string; description: string }
  /** One ``RepositoryItem`` per entry. */
  renderItem: (item: T) => ReactNode
}

/** Entries of a setting that each belong to a repository, while loading, failed or empty too. */
export function RepositoryList<T>({
  query,
  errorTitle,
  empty,
  renderItem,
}: RepositoryListProps<T>) {
  if (query.isPending) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
      </div>
    )
  }
  if (query.isError) {
    return (
      <ErrorState
        title={errorTitle}
        description="The server didn't respond. Try again in a moment."
        onAction={() => void query.refetch()}
        className="border border-dashed py-6"
      />
    )
  }
  if (query.data.length === 0) {
    return <EmptyState {...empty} className="border border-dashed py-6" />
  }
  return <ItemGroup className="gap-2">{query.data.map(renderItem)}</ItemGroup>
}

interface RepositoryItemProps {
  repository: Repository
  title: string
  titleClassName?: string
  description: string
  /** A button that acts on the entry. */
  action: ReactNode
}

export function RepositoryItem({
  repository,
  title,
  titleClassName,
  description,
  action,
}: RepositoryItemProps) {
  return (
    <Item variant="outline" size="sm">
      <ItemMedia>
        <RepoAvatar repository={repository} className="size-8" />
      </ItemMedia>
      <ItemContent className="min-w-0">
        <ItemTitle className={cn("w-full truncate", titleClassName)}>{title}</ItemTitle>
        <ItemDescription className="truncate">{description}</ItemDescription>
      </ItemContent>
      <ItemActions>{action}</ItemActions>
    </Item>
  )
}
