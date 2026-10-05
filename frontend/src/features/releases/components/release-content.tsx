import { BookOpenIcon, ExternalLinkIcon, FileTextIcon, ScrollTextIcon } from "lucide-react"
import { lazy, Suspense } from "react"

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
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ApiError } from "@/lib/api/client"
import type { Release } from "@/lib/api/types"
import { fileBaseUrls, repositoryBaseUrls } from "@/lib/markdown-urls"

import { useReadme } from "../api"

// The markdown pipeline is the largest dependency; load it with the first release that's opened.
const Markdown = lazy(() =>
  import("@/components/markdown").then((module) => ({ default: module.Markdown }))
)

export type ContentTab = "notes" | "readme"

interface ReleaseContentProps {
  release: Release
  /** Release notes; `undefined` while they are loading. */
  body: string | null | undefined
  tab: ContentTab
  onTabChange: (tab: ContentTab) => void
}

export function ReleaseContent({ release, body, tab, onTabChange }: ReleaseContentProps) {
  return (
    <Tabs
      value={tab}
      onValueChange={(value) => onTabChange(value as ContentTab)}
      className="min-h-0 flex-1 gap-0"
    >
      <div className="border-b px-6">
        <TabsList variant="line" className="h-11">
          <TabsTrigger value="notes">
            <ScrollTextIcon data-icon="inline-start" />
            Release notes
          </TabsTrigger>
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
          <TabsContent value="readme" className="px-6 py-6">
            <RepositoryReadme release={release} active={tab === "readme"} />
          </TabsContent>
        </Suspense>
      </ScrollArea>
    </Tabs>
  )
}

function ReleaseNotes({ release, body }: { release: Release; body: string | null | undefined }) {
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
  const { repository } = release
  return (
    <Markdown
      content={body}
      baseUrls={repositoryBaseUrls(repository.html_url, repository.full_name)}
    />
  )
}

function RepositoryReadme({ release, active }: { release: Release; active: boolean }) {
  const { repository } = release
  const readme = useReadme(repository.id, active)

  if (readme.isPending) return <ContentSkeleton />
  if (readme.isError) {
    const missing = readme.error instanceof ApiError && readme.error.status === 404
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <BookOpenIcon />
          </EmptyMedia>
          <EmptyTitle>{missing ? "No README" : "Couldn't load the README"}</EmptyTitle>
          <EmptyDescription>
            {missing
              ? "This repository doesn't have a README."
              : "GitHub didn't respond. Try again in a moment."}
          </EmptyDescription>
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
  return (
    <Markdown
      content={readme.data.content}
      baseUrls={fileBaseUrls(readme.data.html_url, readme.data.download_url)}
    />
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
