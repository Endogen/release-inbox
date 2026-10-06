import {
  BookOpenIcon,
  ExternalLinkIcon,
  FileTextIcon,
  RefreshCwIcon,
  ScrollTextIcon,
  SparklesIcon,
} from "lucide-react"
import { lazy, Suspense, useMemo } from "react"

import { RelativeTime } from "@/components/relative-time"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { SummaryPanel } from "@/features/summaries/summary-panel"
import { ApiError } from "@/lib/api/client"
import type { Readme, Release, ReleaseDetail, Repository } from "@/lib/api/types"
import { fileBaseUrls, repositoryBaseUrls } from "@/lib/markdown-urls"

import { useReadme, useUnreadReleases } from "../api"
import { releaseTitle } from "../release-title"

// The markdown pipeline is the largest dependency; load it with the first release that's opened.
const Markdown = lazy(() =>
  import("@/components/markdown").then((module) => ({ default: module.Markdown }))
)

export type ContentTab = "notes" | "changes" | "readme"

interface ReleaseContentProps {
  release: Release
  /** Release notes; `undefined` while they are loading. */
  body: string | null | undefined
  /** Unread releases of the repository besides this one (shows "What's new"). */
  unreadCount: number
  tab: ContentTab
  onTabChange: (tab: ContentTab) => void
}

export function ReleaseContent({
  release,
  body,
  unreadCount,
  tab,
  onTabChange,
}: ReleaseContentProps) {
  const showChanges = unreadCount > 1
  const activeTab = tab === "changes" && !showChanges ? "notes" : tab

  return (
    <Tabs
      value={activeTab}
      onValueChange={(value) => onTabChange(value as ContentTab)}
      className="min-h-0 flex-1 gap-0"
    >
      <div className="border-b px-6">
        <TabsList variant="line" className="h-11">
          <TabsTrigger value="notes">
            <ScrollTextIcon data-icon="inline-start" />
            Release notes
          </TabsTrigger>
          {showChanges && (
            <TabsTrigger value="changes">
              <SparklesIcon data-icon="inline-start" />
              What's new
              <Badge variant="secondary" className="tabular-nums">
                {unreadCount}
              </Badge>
            </TabsTrigger>
          )}
          <TabsTrigger value="readme">
            <BookOpenIcon data-icon="inline-start" />
            README
          </TabsTrigger>
        </TabsList>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <Suspense fallback={<ContentSkeleton />}>
          <TabsContent value="notes" className="px-6 py-6">
            <ReleaseNotes release={release} body={body} />
          </TabsContent>
          {showChanges && (
            <TabsContent value="changes" className="px-6 py-6">
              <WhatsNew repositoryId={release.repository.id} active={activeTab === "changes"} />
            </TabsContent>
          )}
          <TabsContent value="readme" className="px-6 py-6">
            <RepositoryReadme release={release} active={activeTab === "readme"} />
          </TabsContent>
        </Suspense>
      </ScrollArea>
    </Tabs>
  )
}

function ReleaseNotes({ release, body }: { release: Release; body: string | null | undefined }) {
  const { repository } = release
  const baseUrls = useMemo(
    () => repositoryBaseUrls(repository.html_url, repository.full_name),
    [repository.html_url, repository.full_name]
  )
  if (body === undefined) return <ContentSkeleton />
  if (!body?.trim()) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FileTextIcon />
          </EmptyMedia>
          <EmptyTitle>No release notes</EmptyTitle>
          <EmptyDescription>This release was published without a description.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }
  return (
    <>
      <SummaryPanel
        key={release.id}
        releaseIds={[release.id]}
        baseUrls={baseUrls}
        subject="this release"
      />
      <Markdown content={body} baseUrls={baseUrls} />
    </>
  )
}

/** The notes of every unread release of the repository, newest first. */
function WhatsNew({ repositoryId, active }: { repositoryId: number; active: boolean }) {
  const unread = useUnreadReleases(repositoryId, active)
  if (unread.isPending) return <ContentSkeleton />
  if (unread.isError) return <LoadError onRetry={() => void unread.refetch()} />

  const [newest] = unread.data
  return newest ? <WhatsNewList repository={newest.repository} releases={unread.data} /> : null
}

function WhatsNewList({
  repository,
  releases,
}: {
  repository: Repository
  releases: ReleaseDetail[]
}) {
  const { html_url, full_name } = repository
  const baseUrls = useMemo(() => repositoryBaseUrls(html_url, full_name), [html_url, full_name])
  return (
    <div className="flex flex-col gap-8">
      <SummaryPanel
        key={releases.map((release) => release.id).join(",")}
        releaseIds={releases.map((release) => release.id)}
        baseUrls={baseUrls}
        subject={`these ${releases.length} releases`}
      />
      {releases.map((release, index) => (
        <section key={release.id} aria-labelledby={`changes-${release.id}`}>
          {index > 0 && <Separator className="mb-8" />}
          <WhatsNewHeading release={release} />
          {release.body?.trim() ? (
            <Markdown content={release.body} baseUrls={baseUrls} />
          ) : (
            <p className="text-sm text-muted-foreground">No release notes.</p>
          )}
        </section>
      ))}
    </div>
  )
}

function WhatsNewHeading({ release }: { release: ReleaseDetail }) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <h2 id={`changes-${release.id}`} className="text-lg font-semibold tracking-tight">
        {releaseTitle(release)}
      </h2>
      <Badge variant="outline" className="font-mono">
        {release.tag_name}
      </Badge>
      {release.breaking && <Badge variant="destructive">Breaking</Badge>}
      {release.prerelease && <Badge variant="secondary">Pre-release</Badge>}
      <RelativeTime date={release.published_at} className="text-sm text-muted-foreground" />
    </div>
  )
}

function RepositoryReadme({ release, active }: { release: Release; active: boolean }) {
  const { repository } = release
  const readme = useReadme(repository.id, active)

  if (readme.isPending) return <ContentSkeleton />
  if (readme.isError) {
    const missing = readme.error instanceof ApiError && readme.error.status === 404
    if (!missing) return <LoadError onRetry={() => void readme.refetch()} />
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <BookOpenIcon />
          </EmptyMedia>
          <EmptyTitle>No README</EmptyTitle>
          <EmptyDescription>This repository doesn't have a README.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button variant="outline" size="sm" asChild>
            <a href={repository.html_url} target="_blank" rel="noopener noreferrer">
              Open repository
              <ExternalLinkIcon data-icon="inline-end" />
            </a>
          </Button>
        </EmptyContent>
      </Empty>
    )
  }
  return <ReadmeMarkdown readme={readme.data} />
}

function ReadmeMarkdown({ readme }: { readme: Readme }) {
  const baseUrls = useMemo(
    () => fileBaseUrls(readme.html_url, readme.download_url),
    [readme.html_url, readme.download_url]
  )
  return <Markdown content={readme.content} baseUrls={baseUrls} />
}

function LoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <RefreshCwIcon />
        </EmptyMedia>
        <EmptyTitle>Couldn't load this</EmptyTitle>
        <EmptyDescription>GitHub or the server didn't respond. Try again in a moment.</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      </EmptyContent>
    </Empty>
  )
}

function ContentSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-busy aria-label="Loading">
      <Skeleton className="h-6 w-1/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-11/12" />
      <Skeleton className="h-4 w-4/5" />
      <Skeleton className="mt-3 h-5 w-1/4" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-2/3" />
    </div>
  )
}
