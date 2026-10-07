import { EyeOffIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { HideRuleRef } from "@/lib/api/types"
import { plural } from "@/lib/plural"
import { toastWithUndo } from "@/lib/toasts"

import { useCreateHideRule, useDeleteHideRule } from "./api"

interface HiddenNoticeProps {
  repositoryId: number
  /** The rules that hide the release; empty if it is hidden as a pre-release. */
  rules: readonly HideRuleRef[]
  onOpenSettings: () => void
}

/** Why a release is hidden, with the way to show it again. */
export function HiddenNotice({ repositoryId, rules, onOpenSettings }: HiddenNoticeProps) {
  const deleteRule = useDeleteHideRule()
  const createRule = useCreateHideRule()

  async function showAgain() {
    try {
      await Promise.all(rules.map((rule) => deleteRule.mutateAsync(rule.id)))
    } catch {
      return // The mutation reports the failure.
    }
    const [first] = rules
    toastWithUndo(
      rules.length === 1 && first ? `Showing "${first.pattern}" again` : "Showing them again",
      {
        onUndo: () => {
          for (const rule of rules) createRule.mutate({ repositoryId, pattern: rule.pattern })
        },
      }
    )
  }

  const [first] = rules
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-muted/40 px-3 py-2 text-sm">
      <EyeOffIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      <div className="flex min-w-0 flex-1 flex-col">
        {first === undefined ? (
          <span>Hidden because pre-releases are hidden</span>
        ) : rules.length === 1 ? (
          <>
            <span className="truncate">
              Hidden by the rule <code className="font-mono">{first.pattern}</code>
            </span>
            <span className="text-xs text-muted-foreground">
              It hides {plural(first.match_count, "release")}
            </span>
          </>
        ) : (
          <span className="truncate">
            Hidden by the rules{" "}
            {rules.map((rule) => (
              <code key={rule.id} className="mr-1 font-mono">
                {rule.pattern}
              </code>
            ))}
          </span>
        )}
      </div>
      {first === undefined ? (
        <Button variant="ghost" size="sm" onClick={onOpenSettings}>
          Change
        </Button>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void showAgain()}
          disabled={deleteRule.isPending}
        >
          Show again
        </Button>
      )}
    </div>
  )
}
