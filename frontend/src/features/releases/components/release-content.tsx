import {
  BookOpenIcon,
  ExternalLinkIcon,
  FileTextIcon,
  RefreshCwIcon,
  ScrollTextIcon,
  SparklesIcon,
} from "lucide-react"
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

export type ContentTab = "notes" | "changes" | "readme"

interface ReleaseContentProps {
  release: Release
  /** Release notes; `undefined` while they are loading. */
  body: string | null | undefined
  /** Unread releases of the entry, shown under "What's new"; 0 hides the tab. */
  whatsNewCount: number
  tab: ContentTab
  onTabChange: (tab: ContentTab) => void
}

export function ReleaseContent({
  release,
  body,
  whatsNewCount,
  tab,
  onTabChange,
}: ReleaseContentProps) {
  const showChanges = whatsNewCount > 0
  const activeTab = tab === "changes" && !showChanges ? "notes" : tab

  return (
    <Tabs
      value={activeTab}
      onValueChange={(value) => onTabChange(value as ContentTab)}
      className="min-h-0 flex-1 gap-0"
    >
      <div className="@container overflow-x-auto border-b px-6">
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
      <ScrollArea className="min-h-0 flex-1">
        <TabsContent value="notes" className="px-6 py-6">
          <ReleaseNotes release={release} body={body} />
        </TabsContent>
        {showChanges && (
          <TabsContent value="changes" className="px-6 py-6">
            <WhatsNew release={release} active={activeTab === "changes"} />
          </TabsContent>
        )}
        <TabsContent value="readme" className="px-6 py-6">
          <RepositoryReadme release={release} active={activeTab === "readme"} />
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
function WhatsNew({ release, active }: { release: Release; active: boolean }) {
  const unread = useUnreadReleases(release.repository.id, active)
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
      {release.breaking && <Badge variant="destructive">Breaking</Badge>}
      {release.prerelease && <Badge variant="secondary">Pre-release</Badge>}
      <RelativeTime date={release.published_at} className="text-sm text-muted-foreground" />
    </div>
  )
}

function RepositoryReadme({ release, active }: { release: Release; active: boolean }) {
  const { repository } = release
  const readme = useReadme(repository.id, active)

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
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <RefreshCwIcon />
        </EmptyMedia>
        <EmptyTitle>Couldn't load this</EmptyTitle>
        <EmptyDescription>
          GitHub or the server didn't respond. Try again in a moment.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      </EmptyContent>
    </Empty>
  )
}
