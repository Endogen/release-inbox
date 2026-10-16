import { ArrowUpRightIcon, CheckIcon } from "lucide-react"

import { CodeBlock } from "@/components/code-block"
import { Reveal } from "@/components/reveal"
import { Section } from "@/components/section"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { site } from "@/lib/site"

const SERVER = `# An outline for Ubuntu 24.04; the guide has every step
sudo git clone https://github.com/${site.repository} /opt/ghr
cd /opt/ghr/backend && sudo uv sync --frozen --no-dev
cd /opt/ghr/frontend && sudo npm ci && sudo npm run build
# Settings: a GitHub token, your sign-in and secrets (see the guide)
sudo install -d -m 0750 /etc/ghr
sudo install -m 0640 /opt/ghr/deploy/ghr.env.example /etc/ghr/ghr.env
sudo cp /opt/ghr/deploy/ghr.service /etc/systemd/system/
sudo systemctl enable --now ghr`

const LOCAL = `# Python 3.12+ with uv, Node.js 22+
git clone https://github.com/${site.repository} && cd release-inbox
# Put your GitHub token and sign-in into backend/.env (see the README)
cd backend && uv sync && uv run ghr migrate && uv run ghr serve
# In a second terminal: the app on http://localhost:5173
cd frontend && npm install && npm run dev`

const NEEDS = [
  "A classic GitHub token with the notifications and repo scopes",
  "A small Linux server, or any machine with Python and Node.js",
  "Optional: VAPID keys, ntfy, Telegram or an Anthropic key",
] as const

export function SelfHost() {
  return (
    <Section id="self-host">
      <div className="grid gap-12 lg:grid-cols-[2fr_3fr]">
        <Reveal className="min-w-0">
          <p className="mb-3 font-mono text-xs font-medium tracking-widest text-brand uppercase">
            Self-host
          </p>
          <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            Your server, your data
          </h2>
          <p className="mt-4 text-lg text-pretty text-muted-foreground">
            Releases runs as a single process with SQLite next to it. It talks to GitHub with your
            token and to nobody else unless you set it up.
          </p>
          <ul className="mt-8 space-y-3">
            {NEEDS.map((need) => (
              <li key={need} className="flex gap-3 text-sm">
                <CheckIcon className="mt-0.5 size-4 shrink-0 text-brand" />
                {need}
              </li>
            ))}
          </ul>
          <Button variant="outline" className="mt-8" asChild>
            <a href={site.deploymentGuideUrl}>
              The full deployment guide <ArrowUpRightIcon />
            </a>
          </Button>
        </Reveal>

        {/* min-w-0: long commands scroll inside the block instead of widening the page. */}
        <Reveal delay={120} className="min-w-0">
          <Tabs defaultValue="server">
            <TabsList>
              <TabsTrigger value="server">Server (Ubuntu)</TabsTrigger>
              <TabsTrigger value="local">Try it locally</TabsTrigger>
            </TabsList>
            <TabsContent value="server" className="mt-3">
              <CodeBlock code={SERVER} />
              <p className="mt-3 text-sm text-muted-foreground">
                Then put nginx with TLS in front of it; the guide has the site configuration and a
                daily backup.
              </p>
            </TabsContent>
            <TabsContent value="local" className="mt-3">
              <CodeBlock code={LOCAL} />
              <p className="mt-3 text-sm text-muted-foreground">
                In the desktop app, connect to{" "}
                <span className="font-mono text-foreground">http://localhost:5173</span>.
              </p>
            </TabsContent>
          </Tabs>
        </Reveal>
      </div>
    </Section>
  )
}
