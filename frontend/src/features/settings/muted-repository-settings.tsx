import { BellIcon, BellOffIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { FieldDescription, FieldLegend, FieldSet } from "@/components/ui/field"
import { useMutedRepositories, useSetRepositoryNotifications } from "@/features/repositories/api"

import { RepositoryItem, RepositoryList } from "./repository-list"

export function MutedRepositorySettings() {
  const muted = useMutedRepositories()
  const setNotifications = useSetRepositoryNotifications()

  return (
    <FieldSet>
      <FieldLegend variant="label">Muted repositories</FieldLegend>
      <FieldDescription>
        Every repository you watch notifies you, including ones you watch later.
      </FieldDescription>
      <RepositoryList
        query={muted}
        errorTitle="Couldn't load muted repositories"
        empty={{
          icon: BellOffIcon,
          title: "No muted repositories",
          description: "Mute a repository with the bell on any of its releases.",
        }}
        renderItem={(repository) => (
          <RepositoryItem
            key={repository.id}
            repository={repository}
            title={repository.full_name}
            description="No notifications"
            action={
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
            }
          />
        )}
      />
    </FieldSet>
  )
}
