import { EyeOffIcon, Trash2Icon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { FieldDescription, FieldLegend, FieldSet } from "@/components/ui/field"
import { useDeleteHideRule, useHideRules } from "@/features/hide-rules/api"
import { plural } from "@/lib/plural"

import { RepositoryItem, RepositoryList } from "./repository-list"

export function HideRuleSettings() {
  const rules = useHideRules()
  const deleteRule = useDeleteHideRule()

  return (
    <FieldSet>
      <FieldLegend>Hidden components</FieldLegend>
      <FieldDescription>
        Releases matching these patterns are kept in the Hidden view.
      </FieldDescription>
      <RepositoryList
        query={rules}
        errorTitle="Couldn't load hidden components"
        empty={{
          icon: EyeOffIcon,
          title: "No hidden components",
          description: "Choose Hide on a release to stop seeing a component of a repository.",
        }}
        renderItem={(rule) => (
          <RepositoryItem
            key={rule.id}
            repository={rule.repository}
            title={rule.pattern}
            titleClassName="font-mono"
            description={`${rule.repository.full_name} · ${plural(rule.match_count, "release")}`}
            action={
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
            }
          />
        )}
      />
    </FieldSet>
  )
}
