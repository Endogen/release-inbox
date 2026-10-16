import type { Metadata } from "next"

import { LegalPage } from "@/components/legal-page"
import { site } from "@/lib/site"

export const metadata: Metadata = {
  title: "Privacy policy",
  description: "What the Releases website, app and desktop app collect and send.",
}

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy policy" updated="October 16, 2026">
      <p>
        Releases is software you run yourself. There is no Releases service, account or company
        that receives your data; the maintainer never sees what you do with it.
      </p>

      <h2>This website</h2>
      <p>
        The website uses no cookies, no analytics and no tracking. It is hosted on GitHub Pages;
        GitHub may log technical data such as IP addresses to operate the service, as described
        in the{" "}
        <a href="https://docs.github.com/site-policy/privacy-policies/github-general-privacy-statement">
          GitHub Privacy Statement
        </a>
        . Download links point to files on GitHub.
      </p>

      <h2>The server and web app</h2>
      <p>Your Releases server stores its data in a database on that server. It connects to:</p>
      <ul>
        <li>
          <strong>GitHub</strong>, with the token you configure, to read your notifications and
          releases, mark notifications as read and unsubscribe when you ask it to.
        </li>
        <li>
          <strong>Anthropic</strong>, only if you configure an API key and request a summary;
          the release notes to summarise are sent then.
        </li>
        <li>
          <strong>Push services, ntfy and Telegram</strong>, only if you set them up, to deliver
          notifications about new releases.
        </li>
      </ul>

      <h2>The desktop app</h2>
      <p>
        The desktop app connects only to the server address you enter, and opens links in your
        browser. It stores that address and its settings on your computer. It sends no usage
        data, crash reports or other information anywhere.
      </p>

      <h2>Questions</h2>
      <p>
        Questions about privacy are welcome as an <a href={site.issuesUrl}>issue on GitHub</a>.
      </p>
    </LegalPage>
  )
}
