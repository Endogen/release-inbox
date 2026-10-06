/** Resolution of the URLs found in release notes and READMEs, which are relative to GitHub. */

import type { Readme, Repository } from "@/lib/api/types"

export interface MarkdownBaseUrls {
  /** Base for relative links, e.g. "https://github.com/owner/repo/blob/main/". */
  links: string
  /** Base for relative images, e.g. "https://raw.githubusercontent.com/owner/repo/main/". */
  images: string
  /** Query appended to resolved images, e.g. the access token of a private repository. */
  imageQuery?: string
}

/** Sanitised markdown prefixes element ids to avoid clobbering the page's own ids. */
const ID_PREFIX = "user-content-"

const ABSOLUTE_URL = /^[a-z][a-z\d+.-]*:|^\/\//i

/** Base URLs for files referenced from a release of a repository. */
export function repositoryBaseUrls(
  repository: Pick<Repository, "html_url" | "full_name">
): MarkdownBaseUrls {
  return {
    links: `${repository.html_url}/blob/HEAD/`,
    images: `https://raw.githubusercontent.com/${repository.full_name}/HEAD/`,
  }
}

/** Base URLs relative to the directory that contains a file, such as a README. */
export function fileBaseUrls(file: Pick<Readme, "html_url" | "download_url">): MarkdownBaseUrls {
  const download = new URL(file.download_url)
  return {
    links: directory(file.html_url),
    images: directory(`${download.origin}${download.pathname}`),
    imageQuery: download.search ? download.search.slice(1) : undefined,
  }
}

/** In-page anchor target for ``#heading``, matching the prefixed ids of sanitised markdown. */
export function anchorTarget(hash: string): string {
  const id = decodeOrKeep(hash.replace(/^#/, ""))
  return id.startsWith(ID_PREFIX) ? id : `${ID_PREFIX}${id}`
}

/**
 * Resolve a link (``kind: "link"``) or image (``kind: "image"``) URL against the bases.
 * URLs that can't be parsed are returned unchanged.
 */
export function resolveUrl(url: string, kind: "link" | "image", bases: MarkdownBaseUrls): string {
  if (url.startsWith("#")) return `#${anchorTarget(url)}`
  if (ABSOLUTE_URL.test(url)) return url
  const base = kind === "image" ? bases.images : bases.links
  if (!URL.canParse(url, base)) return url
  const resolved = new URL(url.replace(/^\.\//, ""), base)
  if (kind === "image" && bases.imageQuery && !resolved.search) {
    resolved.search = bases.imageQuery
  }
  return resolved.href
}

/** Resolve every candidate of a ``srcset`` attribute ("a.png 1x, b.png 2x"). */
export function resolveSrcSet(srcSet: string, bases: MarkdownBaseUrls): string {
  return srcSet
    .split(",")
    .map((candidate) => {
      const [url, ...descriptor] = candidate.trim().split(/\s+/)
      return url ? [resolveUrl(url, "image", bases), ...descriptor].join(" ") : ""
    })
    .filter(Boolean)
    .join(", ")
}

/** Percent-decode, keeping text that isn't valid percent-encoding as it is. */
function decodeOrKeep(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function directory(url: string): string {
  return url.slice(0, url.lastIndexOf("/") + 1)
}
