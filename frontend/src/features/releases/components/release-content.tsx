import {
  BookOpenIcon,
  ExternalLinkIcon,
  FileTextIcon,
  ScrollTextIcon,
  SparklesIcon,
} from "lucide-react"

import { ErrorState } from "@/components/error-state"
import { LazyMarkdown, MarkdownSkeleton } from "@/components/lazy-markdown"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MAX_SUMMARIZED_RELEASES } from "@/features/summaries/api"
import { SummaryPanel } from "@/features/summaries/summary-panel"
import { ApiError } from "@/lib/api/client"
import type { Release, ReleaseDetail } from "@/lib/api/types"
import { fileBaseUrls, repositoryBaseUrls } from "@/lib/markdown-urls"

import { useReadme, useUnreadReleases } from "../api"
import { releaseTitle } from "../release-title"
import { BreakingBadge, PrereleaseBadge } from "./release-badges"

export const CONTENT_TABS = ["notes", "changes", "readme"] as const
export type ContentTab = (typeof CONTENT_TABS)[number]

interface ReleaseContentProps {
  release: Release
  /** Release notes; `undefined` while they are loading. */
  body: string | null | undefined
  /** Unread releases of the entry, shown under "What's new"; 0 hides the tab. */
  whatsNewCount: number
  /** The list's search, which narrows what the entry stands for. */
  search: string
  /** The shown tab; "changes" only while there is something new. */
  tab: ContentTab
  onTabChange: (tab: ContentTab) => void
}

export function ReleaseContent({
  release,
  body,
  whatsNewCount,
  search,
  tab,
  onTabChange,
}: ReleaseContentProps) {
  const showChanges = whatsNewCount > 0

  return (
    <Tabs
      value={tab}
      onValueChange={(value) => onTabChange(value as ContentTab)}
      className="min-h-0 flex-1 gap-0"
    >
      <div className="@container border-b px-6">
        <TabsList variant="line" className="h-11">
          <TabsTrigger value="notes">
            <ScrollTextIcon data-icon="inline-start" className="hidden @sm:block" />
            {/* The smallest phones fit all three tabs only with the short label. */}
            <span className="@max-2xs:hidden">Release notes</span>
            <span className="hidden @max-2xs:inline">Notes</span>
          </TabsTrigger>
          {showChanges && (
            <TabsTrigger value="changes">
              <SparklesIcon data-icon="inline-start" className="hidden @sm:block" />
              What's new
              <Badge variant="secondary" className="tabular-nums">
                {whatsNewCount}
              </Badge>
            </TabsTrigger>
          )}
          <TabsTrigger value="readme">
            <BookOpenIcon data-icon="inline-start" className="hidden @sm:block" />
            README
          </TabsTrigger>
        </TabsList>
      </div>
      {/* Inactive tabs are unmounted, so each loads its content when it is opened. */}
      <ScrollArea className="min-h-0 flex-1">
        <TabsContent value="notes" className="px-6 py-6">
          <ReleaseNotes release={release} body={body} />
        </TabsContent>
        {showChanges && (
          <TabsContent value="changes" className="px-6 py-6">
            <WhatsNew release={release} search={search} />
          </TabsContent>
        )}
        <TabsContent value="readme" className="px-6 py-6">
          <RepositoryReadme release={release} />
        </TabsContent>
      </ScrollArea>
    </Tabs>
  )
}

function ReleaseNotes({ release, body }: { release: Release; body: string | null | undefined }) {
  const baseUrls = repositoryBaseUrls(release.repository)
  if (body === undefined) return <MarkdownSkeleton />
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
      <LazyMarkdown content={body} baseUrls={baseUrls} />
    </>
  )
}

/** The notes of every unread release of the entry, newest first. */
function WhatsNew({ release, search }: { release: Release; search: string }) {
  const unread = useUnreadReleases(release.repository.id, search)
  if (unread.isPending) return <MarkdownSkeleton />
  if (unread.isError) return <LoadError onRetry={() => void unread.refetch()} />

  const baseUrls = repositoryBaseUrls(release.repository)
  const summarized = unread.data.slice(0, MAX_SUMMARIZED_RELEASES).map((item) => item.id)
  return (
    <div className="flex flex-col gap-8">
      <SummaryPanel
        key={summarized.join(",")}
        releaseIds={summarized}
        baseUrls={baseUrls}
        subject={
          unread.data.length > summarized.length
            ? `the newest ${summarized.length} releases`
            : `these ${summarized.length} releases`
        }
      />
      {unread.data.map((item, index) => (
        <section key={item.id} aria-labelledby={`changes-${item.id}`}>
          {index > 0 && <Separator className="mb-8" />}
          <WhatsNewHeading release={item} />
          {item.body?.trim() ? (
            <LazyMarkdown content={item.body} baseUrls={baseUrls} />
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
      {release.breaking && <BreakingBadge />}
      {release.prerelease && <PrereleaseBadge />}
      <RelativeTime date={release.published_at} className="text-sm text-muted-foreground" />
    </div>
  )
}

function RepositoryReadme({ release }: { release: Release }) {
  const { repository } = release
  const readme = useReadme(repository.id)

  if (readme.isPending) return <MarkdownSkeleton />
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
  return <LazyMarkdown content={readme.data.content} baseUrls={fileBaseUrls(readme.data)} />
}

function LoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <ErrorState
      title="Couldn't load this"
      description="GitHub or the server didn't respond. Try again in a moment."
      onAction={onRetry}
    />
  )
}
