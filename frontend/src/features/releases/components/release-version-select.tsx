import { EyeOffIcon } from "lucide-react"

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useNow } from "@/hooks/use-now"
import { formatAge } from "@/lib/time"

import { useReleaseHistory } from "../api"
import { releaseTitle } from "../release-title"

interface ReleaseVersionSelectProps {
  repositoryId: number
  releaseId: number
  onSelect: (releaseId: number) => void
}

/** Switches between all known releases of the repository. Hidden when there's only one. */
export function ReleaseVersionSelect({
  repositoryId,
  releaseId,
  onSelect,
}: ReleaseVersionSelectProps) {
  const now = useNow()
  const { data: releases } = useReleaseHistory(repositoryId)
  if (!releases || releases.length < 2) return null
  const current = releases.find((release) => release.id === releaseId)

  return (
    <Select value={String(releaseId)} onValueChange={(value) => onSelect(Number(value))}>
      <SelectTrigger size="sm" aria-label="Version" className="max-w-48 font-mono">
        <SelectValue>{current?.tag_name}</SelectValue>
      </SelectTrigger>
      <SelectContent position="popper" align="end" className="max-h-80">
        <SelectGroup>
          <SelectLabel>{releases.length} releases</SelectLabel>
          {releases.map((release) => (
            <SelectItem key={release.id} value={String(release.id)}>
              <span className="truncate">{releaseTitle(release)}</span>
              {release.read_at === null && (
                <span aria-label="Unread" className="size-1.5 shrink-0 rounded-full bg-primary" />
              )}
              {release.is_hidden && <EyeOffIcon aria-label="Hidden" />}
              <span className="ml-auto pl-3 text-xs text-muted-foreground tabular-nums">
                {formatAge(release.published_at, now)}
              </span>
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}
