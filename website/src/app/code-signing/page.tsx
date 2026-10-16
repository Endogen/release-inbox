import type { Metadata } from "next"
import Link from "next/link"

import { LegalPage } from "@/components/legal-page"
import { site } from "@/lib/site"

export const metadata: Metadata = {
  title: "Code signing policy",
  description: "How the Windows builds of Releases are signed, and who approves them.",
}

export default function CodeSigningPage() {
  return (
    <LegalPage title="Code signing policy" updated="October 16, 2026">
      {site.signing === "pending" && (
        <p className="rounded-xl border border-brand/30 bg-brand/5 p-4 text-sm text-foreground">
          Code signing is being set up. Releases up to now are not signed yet; this policy
          applies to every signed release once SignPath Foundation has approved the project.
        </p>
      )}
      <p>
        <strong>
          Free code signing provided by <a href="https://about.signpath.io/">SignPath.io</a>,
          certificate by <a href="https://signpath.org/">SignPath Foundation</a>.
        </strong>
      </p>
      <p>
        The Windows installers of Releases (<code>.exe</code> and <code>.msi</code>) are signed so
        that Windows can show who published them and that they weren&apos;t changed after the
        build. Signing only covers files built from this project&apos;s own source code.
      </p>

      <h2>How a release gets signed</h2>
      <ul>
        <li>
          Every release is built by GitHub Actions from the public{" "}
          <a href={site.repositoryUrl}>source repository</a>, with the build steps in the
          repository itself. Nothing is built or signed on a personal machine.
        </li>
        <li>
          SignPath verifies that the files come from that automated build before it signs them.
        </li>
        <li>Each signing request is approved by hand by an approver listed below.</li>
      </ul>

      <h2>Team roles</h2>
      <ul>
        <li>
          <strong>Committers and reviewers:</strong>{" "}
          <a href={site.maintainer.url}>{site.maintainer.name}</a>. Changes from anyone else are
          reviewed before they are merged.
        </li>
        <li>
          <strong>Approvers:</strong> <a href={site.maintainer.url}>{site.maintainer.name}</a>
        </li>
      </ul>
      <p>All members use multi-factor authentication for GitHub and SignPath.</p>

      <h2>Privacy</h2>
      <p>
        This program will not transfer any information to other networked systems unless
        specifically requested by the user or the person installing or operating it. The{" "}
        <Link href="/privacy/">privacy policy</Link> describes what the app sends and where.
      </p>

      <h2>Reporting a problem</h2>
      <p>
        If you believe a signed file of this project is malicious or was not built from its
        source, please <a href={site.issuesUrl}>open an issue</a> on GitHub.
      </p>
    </LegalPage>
  )
}
