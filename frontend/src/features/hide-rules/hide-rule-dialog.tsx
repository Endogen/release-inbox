import { AsteriskIcon, SearchXIcon } from "lucide-react"
import { useState, type FormEvent } from "react"

import { RepoAvatar } from "@/components/avatars"
import { EmptyState } from "@/components/empty-state"
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
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import { Spinner } from "@/components/ui/spinner"
import { releaseTitle } from "@/features/releases/release-title"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import { useNow } from "@/hooks/use-now"
import { isConflict } from "@/lib/api/client"
import type { Release, ReleaseRef } from "@/lib/api/types"
import { plural } from "@/lib/plural"
import { formatAge } from "@/lib/time"
import { toastWithUndo } from "@/lib/toasts"

import { useCreateHideRule, useDeleteHideRule, useHideRulePreview } from "./api"
import { suggestPattern } from "./suggest-pattern"

const PREVIEW_DEBOUNCE_MS = 200

interface HideRuleDialogProps {
  /** The release the rule is created from; `null` closes the dialog. */
  release: Release | null
  onOpenChange: (open: boolean) => void
}

export function HideRuleDialog({ release, onOpenChange }: HideRuleDialogProps) {
  // Keep showing the last release while the dialog animates out.
  const [shown, setShown] = useState(release)
  if (release !== null && release !== shown) setShown(release)

  return (
    <Dialog open={release !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {shown && (
          <HideRuleForm key={shown.id} release={shown} onDone={() => onOpenChange(false)} />
        )}
      </DialogContent>
    </Dialog>
  )
}

function HideRuleForm({ release, onDone }: { release: Release; onDone: () => void }) {
  const { repository } = release
  const [pattern, setPattern] = useState(() => suggestPattern(release.tag_name, release.name))
  const trimmed = pattern.trim()
  const debouncedPattern = useDebouncedValue(trimmed, PREVIEW_DEBOUNCE_MS)
  const preview = useHideRulePreview(repository.id, debouncedPattern)
  const createRule = useCreateHideRule()
  const deleteRule = useDeleteHideRule()

  const error = isConflict(createRule.error)
    ? "You already have a rule with this pattern."
    : (createRule.error?.message ?? (preview.isError ? preview.error.message : undefined))

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!trimmed) return
    createRule.mutate(
      { repositoryId: repository.id, pattern: trimmed },
      {
        onSuccess: (rule) => {
          onDone()
          toastWithUndo(`Hiding "${rule.pattern}"`, {
            description: `${plural(rule.match_count, "release")} from ${repository.full_name} hidden.`,
            onUndo: () => deleteRule.mutate(rule.id),
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
        <Item variant="muted" size="sm">
          <ItemMedia>
            <RepoAvatar repository={repository} className="size-8" />
          </ItemMedia>
          <ItemContent className="min-w-0">
            <ItemTitle className="w-full truncate">{repository.full_name}</ItemTitle>
            <ItemDescription className="truncate">From {releaseTitle(release)}</ItemDescription>
          </ItemContent>
        </Item>

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

        <MatchingReleases
          matches={trimmed ? preview.data?.matches : []}
          total={preview.data?.total}
        />
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

function MatchingReleases({
  matches = [],
  total = 0,
}: {
  matches: readonly ReleaseRef[] | undefined
  total: number | undefined
}) {
  const now = useNow()
  return (
    <section aria-labelledby="matching-releases" className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-sm">
        <h3 id="matching-releases" className="font-medium">
          Matching releases
        </h3>
        <Badge variant="secondary" className="tabular-nums">
          {matches.length > 0 ? total : 0}
        </Badge>
      </div>
      <div className="max-h-52 overflow-y-auto rounded-lg border">
        {matches.length > 0 ? (
          <ItemGroup className="p-1">
            {matches.map((match) => (
              <Item key={match.id} size="xs">
                <ItemContent className="min-w-0">
                  <ItemTitle className="w-full truncate">{releaseTitle(match)}</ItemTitle>
                  <ItemDescription className="truncate font-mono">{match.tag_name}</ItemDescription>
                </ItemContent>
                <ItemActions className="text-xs text-muted-foreground tabular-nums">
                  {formatAge(match.published_at, now)}
                </ItemActions>
              </Item>
            ))}
          </ItemGroup>
        ) : (
          <EmptyState
            icon={SearchXIcon}
            title="No releases match yet"
            description="Future releases that match will be hidden."
            className="py-6"
          />
        )}
      </div>
    </section>
  )
}
