import { memo, useMemo, type MouseEvent } from "react"
import ReactMarkdown, { defaultUrlTransform, type Components } from "react-markdown"
import rehypeRaw from "rehype-raw"
import rehypeSanitize, { defaultSchema } from "rehype-sanitize"
import rehypeSlug from "rehype-slug"
import remarkGfm from "remark-gfm"

import {
  anchorTarget,
  resolveSrcSet,
  resolveUrl,
  type MarkdownBaseUrls,
} from "@/lib/markdown-urls"
import { cn } from "@/lib/utils"

interface MarkdownProps {
  content: string
  baseUrls: MarkdownBaseUrls
  className?: string
}

/** GitHub's sanitize schema, plus ``media`` so ``<picture>`` light/dark sources work. */
const SANITIZE_SCHEMA = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    source: [...(defaultSchema.attributes?.source ?? []), "media"],
  },
}

// Footnote ids must not get remark's own prefix; sanitising adds "user-content-" once.
const REMARK_REHYPE_OPTIONS = { clobberPrefix: "" }

function scrollToAnchor(event: MouseEvent<HTMLAnchorElement>, href: string) {
  // Scroll inside the pane without touching the app's URL (the router owns it).
  const target = document.getElementById(anchorTarget(href))
  if (!target) return
  event.preventDefault()
  target.scrollIntoView({ behavior: "smooth", block: "start" })
}

/** Renders GitHub-flavoured markdown (including sanitised inline HTML) from a repository. */
export const Markdown = memo(function Markdown({ content, baseUrls, className }: MarkdownProps) {
  const components = useMemo<Components>(
    () => ({
      a: ({ node: _node, href, children, ...props }) =>
        href?.startsWith("#") ? (
          <a href={href} {...props} onClick={(event) => scrollToAnchor(event, href)}>
            {children}
          </a>
        ) : (
          <a href={href} {...props} target="_blank" rel="noopener noreferrer">
            {children}
          </a>
        ),
      img: ({ node: _node, alt, srcSet, ...props }) => (
        <img
          alt={alt ?? ""}
          loading="lazy"
          srcSet={srcSet ? resolveSrcSet(srcSet, baseUrls) : undefined}
          {...props}
        />
      ),
      source: ({ node: _node, srcSet, ...props }) => (
        <source srcSet={srcSet ? resolveSrcSet(srcSet, baseUrls) : undefined} {...props} />
      ),
    }),
    [baseUrls]
  )

  const transformUrl = useMemo(
    () => (url: string, key: string) =>
      defaultUrlTransform(resolveUrl(url, key === "src" ? "image" : "link", baseUrls)),
    [baseUrls]
  )

  return (
    <div
      className={cn(
        "prose prose-sm prose-theme max-w-none break-words prose-headings:scroll-mt-4 prose-headings:font-semibold prose-headings:tracking-tight prose-a:font-medium prose-a:no-underline hover:prose-a:underline prose-code:rounded prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:font-normal prose-code:before:content-none prose-code:after:content-none prose-pre:border prose-img:inline prose-img:rounded-md",
        className
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        remarkRehypeOptions={REMARK_REHYPE_OPTIONS}
        rehypePlugins={[rehypeRaw, rehypeSlug, [rehypeSanitize, SANITIZE_SCHEMA]]}
        urlTransform={transformUrl}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
})
