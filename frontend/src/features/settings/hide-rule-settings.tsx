import { EyeOffIcon, Trash2Icon } from "lucide-react"
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
import { useDeleteHideRule, useHideRules } from "@/features/hide-rules/api"

export function HideRuleSettings() {
  const rules = useHideRules()
  const deleteRule = useDeleteHideRule()

  return (
    <FieldSet>
      <FieldLegend>Hidden components</FieldLegend>
      <FieldDescription>
        Releases matching these patterns are kept in the Hidden view.
      </FieldDescription>
      {rules.isPending ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : rules.data && rules.data.length > 0 ? (
        <ItemGroup className="gap-2">
          {rules.data.map((rule) => (
            <Item key={rule.id} variant="outline" size="sm">
              <ItemMedia>
                <RepoAvatar repository={rule.repository} className="size-8" />
              </ItemMedia>
              <ItemContent className="min-w-0">
                <ItemTitle className="w-full truncate font-mono">{rule.pattern}</ItemTitle>
                <ItemDescription className="truncate">
                  {rule.repository.full_name} · {rule.match_count}{" "}
                  {rule.match_count === 1 ? "release" : "releases"}
                </ItemDescription>
              </ItemContent>
              <ItemActions>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove rule ${rule.pattern}`}
                  disabled={deleteRule.isPending && deleteRule.variables === rule.id}
                  onClick={() =>
                    deleteRule.mutate(rule.id, {
                      onSuccess: () => toast.success(`Showing "${rule.pattern}" again`),
                    })
                  }
                >
                  <Trash2Icon />
                </Button>
              </ItemActions>
            </Item>
          ))}
        </ItemGroup>
      ) : (
        <Empty className="border border-dashed py-6">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <EyeOffIcon />
            </EmptyMedia>
            <EmptyTitle>No hidden components</EmptyTitle>
            <EmptyDescription>
              Choose Hide on a release to stop seeing a component of a repository.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </FieldSet>
  )
}
