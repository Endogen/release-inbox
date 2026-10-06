import { BellIcon, BellOffIcon } from "lucide-react"
import { toast } from "sonner"

import { RepoAvatar } from "@/components/avatars"
import { Button } from "@/components/ui/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { FieldDescription, FieldLegend, FieldSet } from "@/components/ui/field"
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
import { useMutedRepositories, useSetRepositoryNotifications } from "@/features/repositories/api"

export function MutedRepositorySettings() {
  const muted = useMutedRepositories()
  const setNotifications = useSetRepositoryNotifications()

  return (
    <FieldSet>
      <FieldLegend variant="label">Muted repositories</FieldLegend>
      <FieldDescription>
        Every repository you watch notifies you, including ones you watch later.
      </FieldDescription>
      {muted.isPending ? (
        <Skeleton className="h-14 w-full" />
      ) : muted.data && muted.data.length > 0 ? (
        <ItemGroup className="gap-2">
          {muted.data.map((repository) => (
            <Item key={repository.id} variant="outline" size="sm">
              <ItemMedia>
                <RepoAvatar repository={repository} className="size-8" />
              </ItemMedia>
              <ItemContent className="min-w-0">
                <ItemTitle className="w-full truncate">{repository.full_name}</ItemTitle>
                <ItemDescription>No notifications</ItemDescription>
              </ItemContent>
              <ItemActions>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={
                    setNotifications.isPending &&
                    setNotifications.variables.repositoryId === repository.id
                  }
                  onClick={() =>
                    setNotifications.mutate(
                      { repositoryId: repository.id, enabled: true },
                      {
                        onSuccess: () =>
                          toast.success(`Notifications on for ${repository.full_name}`),
                      }
                    )
                  }
                >
                  <BellIcon data-icon="inline-start" />
                  Unmute
                </Button>
              </ItemActions>
            </Item>
          ))}
        </ItemGroup>
      ) : (
        <Empty className="border border-dashed py-6">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <BellOffIcon />
            </EmptyMedia>
            <EmptyTitle>No muted repositories</EmptyTitle>
            <EmptyDescription>
              Mute a repository with the bell on any of its releases.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </FieldSet>
  )
}
