import { EyeOffIcon, TagIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"

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

import type { Release } from "@/lib/api/types"

import { useReleaseHistory } from "../api"
import { releaseTitle } from "../release-title"

interface ReleaseVersionSelectProps {
  release: Release
  onSelect: (releaseId: number) => void
}

/**
 * The tag of the release, which switches between all known releases of the repository. A
 * repository with a single release just shows the tag.
 */
export function ReleaseVersionSelect({ release, onSelect }: ReleaseVersionSelectProps) {
  const now = useNow()
  const { data: releases } = useReleaseHistory(release.repository.id)

  if (!releases || releases.length < 2) {
    return (
      <Badge variant="outline" className="font-mono">
        <TagIcon data-icon="inline-start" />
        {release.tag_name}
      </Badge>
    )
  }

  return (
    <Select value={String(release.id)} onValueChange={(value) => onSelect(Number(value))}>
      <SelectTrigger size="sm" aria-label="Version" className="max-w-64 font-mono">
        <TagIcon />
        <SelectValue>{release.tag_name}</SelectValue>
      </SelectTrigger>
      <SelectContent position="popper" align="start" className="max-h-80">
        <SelectGroup>
          <SelectLabel>{releases.length} releases</SelectLabel>
          {releases.map((item) => (
            <SelectItem key={item.id} value={String(item.id)}>
              <span className="truncate">{releaseTitle(item)}</span>
              {item.read_at === null && (
                <span className="size-1.5 shrink-0 rounded-full bg-primary">
                  <span className="sr-only">Unread</span>
                </span>
              )}
              {item.is_hidden && <EyeOffIcon role="img" aria-label="Hidden" />}
              <span className="ml-auto pl-3 text-xs text-muted-foreground tabular-nums">
                {formatAge(item.published_at, now)}
              </span>
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}
