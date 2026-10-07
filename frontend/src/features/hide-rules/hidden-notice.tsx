import { EyeOffIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { HideRuleRef } from "@/lib/api/types"
import { plural } from "@/lib/plural"
import { toastError, toastWithUndo } from "@/lib/toasts"

import { useCreateHideRule, useDeleteHideRule } from "./api"

interface HiddenNoticeProps {
  repositoryId: number
  /** The rules that hide the release. */
  rules: readonly HideRuleRef[]
  /** It is a pre-release and pre-releases are hidden; removing rules wouldn't show it. */
  hiddenAsPrerelease: boolean
  onOpenSettings: () => void
}

/** Why a release is hidden, with the way to show it again. */
export function HiddenNotice({
  repositoryId,
  rules,
  hiddenAsPrerelease,
  onOpenSettings,
}: HiddenNoticeProps) {
  const deleteRule = useDeleteHideRule()
  const createRule = useCreateHideRule()

  async function showAgain() {
    const results = await Promise.allSettled(rules.map((rule) => deleteRule.mutateAsync(rule.id)))
    // Failures are reported by the mutation; undo covers the rules that were removed.
    const removed = rules.filter((_, index) => results[index]?.status === "fulfilled")
    const [first] = removed
    if (!first) return
    toastWithUndo(
      removed.length === 1 ? `Showing "${first.pattern}" again` : "Showing them again",
      {
        onUndo: () => {
          for (const rule of removed) {
            createRule.mutate(
              { repositoryId, pattern: rule.pattern },
              { onError: (error) => toastError("Couldn't hide them again", error) }
            )
          }
        },
      }
    )
  }

  const patterns = rules.map((rule) => (
    <code key={rule.id} className="mr-1 font-mono last:mr-0">
      {rule.pattern}
    </code>
  ))
  const [first] = rules
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-muted/40 px-3 py-2 text-sm">
      <EyeOffIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      <div className="flex min-w-0 flex-1 flex-col">
        {hiddenAsPrerelease ? (
          <>
            <span>Hidden because pre-releases are hidden</span>
            {first && (
              <span className="truncate text-xs text-muted-foreground">
                Also hidden by {rules.length === 1 ? "the rule" : "the rules"} {patterns}
              </span>
            )}
          </>
        ) : (
          <>
            <span className="truncate">
              Hidden by {rules.length === 1 ? "the rule" : "the rules"} {patterns}
            </span>
            {first && rules.length === 1 && (
              <span className="text-xs text-muted-foreground">
                It hides {plural(first.match_count, "release")}
              </span>
            )}
          </>
        )}
      </div>
      {hiddenAsPrerelease ? (
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
