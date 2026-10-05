import ReactMarkdown, { defaultUrlTransform, type Components } from "react-markdown"
import rehypeRaw from "rehype-raw"
import rehypeSanitize from "rehype-sanitize"
import remarkGfm from "remark-gfm"

import type { MarkdownBaseUrls } from "@/lib/markdown-urls"
import { cn } from "@/lib/utils"

interface MarkdownProps {
  content: string
  baseUrls: MarkdownBaseUrls
  className?: string
}

const ABSOLUTE_URL = /^[a-z][a-z\d+.-]*:|^\/\//i

const components: Components = {
  a: ({ node: _node, href, children, ...props }) => {
    const isAnchor = href?.startsWith("#")
    return (
      <a
        href={href}
        {...props}
        {...(isAnchor ? {} : { target: "_blank", rel: "noopener noreferrer" })}
      >
        {children}
      </a>
    )
  },
  img: ({ node: _node, alt, ...props }) => <img alt={alt ?? ""} loading="lazy" {...props} />,
}

/** Renders GitHub-flavoured markdown (including sanitised inline HTML) from a repository. */
export function Markdown({ content, baseUrls, className }: MarkdownProps) {
  function transformUrl(url: string, key: string): string {
    if (url.startsWith("#") || ABSOLUTE_URL.test(url)) return defaultUrlTransform(url)
    const base = key === "src" ? baseUrls.images : baseUrls.links
    return defaultUrlTransform(new URL(url.replace(/^\.\//, ""), base).href)
  }

  return (
    <div
      className={cn(
        "prose prose-sm prose-theme max-w-none break-words prose-headings:scroll-mt-4 prose-headings:font-semibold prose-headings:tracking-tight prose-a:font-medium prose-a:no-underline hover:prose-a:underline prose-code:rounded prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:font-normal prose-code:before:content-none prose-code:after:content-none prose-pre:border prose-img:inline prose-img:rounded-md",
        className
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, rehypeSanitize]}
        urlTransform={transformUrl}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
