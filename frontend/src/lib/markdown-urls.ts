export interface MarkdownBaseUrls {
  /** Base for relative links, e.g. "https://github.com/owner/repo/blob/main/". */
  links: string
  /** Base for relative images, e.g. "https://raw.githubusercontent.com/owner/repo/main/". */
  images: string
}

/** Base URLs for files referenced from a release or README of a repository. */
export function repositoryBaseUrls(repositoryHtmlUrl: string, fullName: string): MarkdownBaseUrls {
  return {
    links: `${repositoryHtmlUrl}/blob/HEAD/`,
    images: `https://raw.githubusercontent.com/${fullName}/HEAD/`,
  }
}

/** Base URLs relative to the directory that contains a file, such as a README. */
export function fileBaseUrls(htmlUrl: string, downloadUrl: string): MarkdownBaseUrls {
  const directory = (url: string) => url.slice(0, url.lastIndexOf("/") + 1)
  return { links: directory(htmlUrl), images: directory(downloadUrl) }
}
