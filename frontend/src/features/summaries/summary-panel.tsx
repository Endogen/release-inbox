import { SparklesIcon, TriangleAlertIcon } from "lucide-react"

import { LazyMarkdown } from "@/components/lazy-markdown"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import type { MarkdownBaseUrls } from "@/lib/markdown-urls"

import { useSummarize, useSummary, useSummaryConfig } from "./api"

interface SummaryPanelProps {
  releaseIds: readonly number[]
  baseUrls: MarkdownBaseUrls
  /** What is being summarized, e.g. "these 3 releases". */
  subject: string
}

/**
 * The summary of one or more releases by Claude, or a button to create it. Render it with a
 * ``key`` per selection, so a failed or running request doesn't carry over to another one.
 */
export function SummaryPanel({ releaseIds, baseUrls, subject }: SummaryPanelProps) {
  const config = useSummaryConfig()
  const enabled = config.data?.enabled ?? false
  const summary = useSummary(releaseIds, enabled)
  const summarize = useSummarize(releaseIds)
  if (!enabled) return null

  if (summary.isPending) return <Skeleton className="mb-6 h-8 w-48" />

  if (summary.data) {
    return (
      <Card size="sm" className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SparklesIcon aria-hidden className="size-4" />
            Summary
          </CardTitle>
          <CardDescription>Created by {summary.data.model}. It can make mistakes.</CardDescription>
        </CardHeader>
        <CardContent>
          <LazyMarkdown content={summary.data.content} baseUrls={baseUrls} />
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="mb-6 flex flex-col gap-3">
      {summarize.isError && (
        <Alert variant="destructive">
          <TriangleAlertIcon />
          <AlertTitle>Couldn't create a summary</AlertTitle>
          <AlertDescription>{summarize.error.message}</AlertDescription>
        </Alert>
      )}
      <Button
        variant="outline"
        size="sm"
        className="self-start"
        disabled={summarize.isPending}
        onClick={() => summarize.mutate()}
      >
        {summarize.isPending ? (
          <Spinner data-icon="inline-start" />
        ) : (
          <SparklesIcon data-icon="inline-start" />
        )}
        {summarize.isPending ? "Summarizing…" : `Summarize ${subject}`}
      </Button>
    </div>
  )
}
