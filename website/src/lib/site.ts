/** Facts about the project that several pages share. */

const repository = "Endogen/release-inbox"
const repositoryUrl = `https://github.com/${repository}`

export const site = {
  name: "Releases",
  title: "Releases: a calm inbox for the GitHub releases you watch",
  description:
    "A self-hosted inbox for GitHub releases: one entry per repository, release notes, breaking-change badges, AI summaries and one-click triage, with apps for Windows, macOS and Linux.",
  repository,
  repositoryUrl,
  releasesUrl: `${repositoryUrl}/releases`,
  readmeUrl: `${repositoryUrl}#readme`,
  deploymentGuideUrl: `${repositoryUrl}#deployment-on-ubuntu`,
  desktopGuideUrl: `${repositoryUrl}#desktop-app`,
  issuesUrl: `${repositoryUrl}/issues`,
  maintainer: { name: "Endogen", url: "https://github.com/Endogen" },
  /**
   * Whether the Windows builds are signed through SignPath Foundation yet. While "pending",
   * the code signing policy says that signing is being set up.
   */
  signing: "pending" as "pending" | "active",
} as const
