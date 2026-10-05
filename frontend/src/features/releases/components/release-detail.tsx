import {
  ArrowLeftIcon,
  BellOffIcon,
  BookMarkedIcon,
  CheckIcon,
  EyeOffIcon,
  InboxIcon,
  LockIcon,
  TagIcon,
} from "lucide-react"
import type { ReactNode } from "react"

import { RelativeTime } from "@/components/relative-time"
import { RepoAvatar, UserAvatar } from "@/components/repo-avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Kbd } from "@/components/ui/kbd"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { Release } from "@/lib/api/types"

import { releaseTitle } from "../release-title"
import { ReleaseContent, type ContentTab } from "./release-content"
import { ReleaseVersionSelect } from "./release-version-select"

export interface ReleaseDetailActions {
  onMarkRead: () => void
  onMarkUnread: () => void
  onHide: () => void
  onUnsubscribe: () => void
}

interface ReleaseDetailProps {
  release: Release
  body: string | null | undefined
  contentTab: ContentTab
  onContentTabChange: (tab: ContentTab) => void
  onSelectRelease: (releaseId: number) => void
  actions: ReleaseDetailActions
  onBack?: () => void
}

export function ReleaseDetail({
  release,
  body,
  contentTab,
  onContentTabChange,
  onSelectRelease,
  actions,
  onBack,
}: ReleaseDetailProps) {
  const { repository } = release
  const title = releaseTitle(release)

  return (
    <article
      key={release.id}
      className="flex h-full min-h-0 flex-col animate-in duration-300 fade-in slide-in-from-bottom-1"
    >
      <header className="flex flex-col gap-5 border-b px-6 pt-5 pb-5">
        <div className="flex items-center gap-3">
          {onBack && (
            <Button variant="ghost" size="icon-sm" aria-label="Back to list" onClick={onBack}>
              <ArrowLeftIcon />
            </Button>
          )}
          <RepoAvatar repository={repository} className="size-10" />
          <div className="flex min-w-0 flex-1 flex-col">
            <a
              href={repository.html_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 truncate text-sm font-medium hover:underline"
            >
              {repository.full_name}
              {repository.private && <LockIcon className="size-3.5 text-muted-foreground" />}
            </a>
            {repository.description && (
              <p className="truncate text-xs text-muted-foreground" title={repository.description}>
                {repository.description}
              </p>
            )}
          </div>
          <ReleaseVersionSelect
            repositoryId={repository.id}
            releaseId={release.id}
            onSelect={onSelectRelease}
          />
        </div>

        <div className="flex flex-col gap-2.5">
          <h1 className="text-2xl font-semibold tracking-tight text-balance break-words">
            {title}
          </h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground">
            <Badge variant="outline" className="font-mono">
              <TagIcon data-icon="inline-start" />
              {release.tag_name}
            </Badge>
            {release.prerelease && <Badge variant="secondary">Pre-release</Badge>}
            {release.is_hidden && (
              <Badge variant="secondary">
                <EyeOffIcon data-icon="inline-start" />
                Hidden
              </Badge>
            )}
            {repository.unsubscribed_at && (
              <Badge variant="secondary">
                <BellOffIcon data-icon="inline-start" />
                Unsubscribed
              </Badge>
            )}
            {release.author_login && (
              <span className="flex items-center gap-1.5">
                <UserAvatar
                  login={release.author_login}
                  avatarUrl={release.author_avatar_url}
                  className="size-5"
                />
                {release.author_login}
              </span>
            )}
            <span>
              Published <RelativeTime date={release.published_at} />
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {release.read_at === null ? (
            <ActionButton hotkey="e" label="Mark this and older releases as read">
              <Button size="sm" onClick={actions.onMarkRead}>
                <CheckIcon data-icon="inline-start" />
                Mark as read
              </Button>
            </ActionButton>
          ) : (
            <ActionButton hotkey="u" label="Move back to the inbox">
              <Button size="sm" variant="secondary" onClick={actions.onMarkUnread}>
                <InboxIcon data-icon="inline-start" />
                Mark as unread
              </Button>
            </ActionButton>
          )}
          <ActionButton hotkey="h" label="Hide releases of this component">
            <Button size="sm" variant="outline" onClick={actions.onHide}>
              <EyeOffIcon data-icon="inline-start" />
              Hide…
            </Button>
          </ActionButton>
          {!repository.unsubscribed_at && (
            <ActionButton label="Stop watching this repository on GitHub">
              <Button size="sm" variant="outline" onClick={actions.onUnsubscribe}>
                <BellOffIcon data-icon="inline-start" />
                Unsubscribe
              </Button>
            </ActionButton>
          )}

          <div className="ml-auto flex items-center gap-2">
            <ActionButton hotkey="o" label="Open the release on GitHub">
              <Button size="sm" variant="ghost" asChild>
                <a href={release.html_url} target="_blank" rel="noopener noreferrer">
                  <TagIcon data-icon="inline-start" />
                  Release
                </a>
              </Button>
            </ActionButton>
            <ActionButton label="Open the repository on GitHub">
              <Button size="sm" variant="ghost" asChild>
                <a href={repository.html_url} target="_blank" rel="noopener noreferrer">
                  <BookMarkedIcon data-icon="inline-start" />
                  Repository
                </a>
              </Button>
            </ActionButton>
          </div>
        </div>
      </header>

      <ReleaseContent
        release={release}
        body={body}
        tab={contentTab}
        onTabChange={onContentTabChange}
      />
    </article>
  )
}

function ActionButton({
  label,
  hotkey,
  children,
}: {
  label: string
  hotkey?: string
  children: ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent>
        {label}
        {hotkey && <Kbd>{hotkey}</Kbd>}
      </TooltipContent>
    </Tooltip>
  )
}
