import { AsteriskIcon } from "lucide-react"
import { useState, type FormEvent } from "react"
import { toast } from "sonner"

import { RepoAvatar } from "@/components/repo-avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Spinner } from "@/components/ui/spinner"
import { releaseTitle } from "@/features/releases/release-title"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import { useNow } from "@/hooks/use-now"
import { ApiError } from "@/lib/api/client"
import type { Release } from "@/lib/api/types"
import { formatAge } from "@/lib/time"

import { useCreateHideRule, useDeleteHideRule, useHideRulePreview } from "../api"
import { suggestPattern } from "../suggest-pattern"

interface HideRuleDialogProps {
  /** The release the rule is created from; `null` closes the dialog. */
  release: Release | null
  onOpenChange: (open: boolean) => void
}

export function HideRuleDialog({ release, onOpenChange }: HideRuleDialogProps) {
  return (
    <Dialog open={release !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {release && (
          <HideRuleForm key={release.id} release={release} onDone={() => onOpenChange(false)} />
        )}
      </DialogContent>
    </Dialog>
  )
}

function HideRuleForm({ release, onDone }: { release: Release; onDone: () => void }) {
  const { repository } = release
  const [pattern, setPattern] = useState(() => suggestPattern(release.tag_name, release.name))
  const trimmed = pattern.trim()
  const debouncedPattern = useDebouncedValue(trimmed, 200)
  const preview = useHideRulePreview(repository.id, debouncedPattern)
  const createRule = useCreateHideRule()
  const deleteRule = useDeleteHideRule()
  const now = useNow()

  const error =
    createRule.error instanceof ApiError && createRule.error.status === 409
      ? "You already have a rule with this pattern."
      : createRule.error?.message

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!trimmed) return
    createRule.mutate(
      { repositoryId: repository.id, pattern: trimmed },
      {
        onSuccess: (rule) => {
          onDone()
          toast.success(`Hiding "${rule.pattern}"`, {
            description: `${rule.match_count} ${rule.match_count === 1 ? "release" : "releases"} from ${repository.full_name} hidden.`,
            action: { label: "Undo", onClick: () => deleteRule.mutate(rule.id) },
          })
        },
      }
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <DialogHeader>
        <DialogTitle>Hide releases</DialogTitle>
        <DialogDescription>
          Hide releases of a component in this repository. You'll still be subscribed to everything
          else.
        </DialogDescription>
      </DialogHeader>

      <FieldGroup>
        <div className="flex items-center gap-3 rounded-lg border bg-muted/40 p-3">
          <RepoAvatar repository={repository} className="size-8" />
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-medium">{repository.full_name}</span>
            <span className="truncate text-xs text-muted-foreground">
              From {releaseTitle(release)}
            </span>
          </div>
        </div>

        <Field data-invalid={error ? true : undefined}>
          <FieldLabel htmlFor="hide-pattern">Name or tag pattern</FieldLabel>
          <InputGroup>
            <InputGroupInput
              id="hide-pattern"
              value={pattern}
              onChange={(event) => {
                setPattern(event.target.value)
                createRule.reset()
              }}
              className="font-mono"
              autoFocus
              autoComplete="off"
              spellCheck={false}
              aria-invalid={error ? true : undefined}
            />
            <InputGroupAddon align="inline-end">
              {preview.isFetching ? <Spinner /> : <AsteriskIcon />}
            </InputGroupAddon>
          </InputGroup>
          <FieldDescription>
            Use <code className="font-mono">*</code> to match anything, for example{" "}
            <code className="font-mono">web@*</code>. Matching ignores case.
          </FieldDescription>
          {error && <FieldError>{error}</FieldError>}
        </Field>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Matching releases</span>
            <Badge variant="secondary" className="tabular-nums">
              {trimmed ? (preview.data?.total ?? 0) : 0}
            </Badge>
          </div>
          <ul className="flex max-h-48 flex-col overflow-y-auto rounded-lg border">
            {trimmed && preview.data && preview.data.matches.length > 0 ? (
              preview.data.matches.map((match) => (
                <li
                  key={match.id}
                  className="flex items-center gap-3 border-b px-3 py-2 text-sm last:border-b-0"
                >
                  <span className="truncate font-mono text-xs">{match.tag_name}</span>
                  <span className="truncate text-muted-foreground">{releaseTitle(match)}</span>
                  <span className="ml-auto shrink-0 text-xs text-muted-foreground tabular-nums">
                    {formatAge(match.published_at, now)}
                  </span>
                </li>
              ))
            ) : (
              <li className="px-3 py-6 text-center text-sm text-muted-foreground">
                No releases match yet. Future releases that match will be hidden.
              </li>
            )}
          </ul>
        </div>
      </FieldGroup>

      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline">
            Cancel
          </Button>
        </DialogClose>
        <Button type="submit" disabled={!trimmed || createRule.isPending}>
          {createRule.isPending && <Spinner data-icon="inline-start" />}
          Hide releases
        </Button>
      </DialogFooter>
    </form>
  )
}
