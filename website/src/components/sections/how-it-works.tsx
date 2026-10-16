import {
  ArrowRightIcon,
  CircleDotIcon,
  EyeIcon,
  GitPullRequestIcon,
  InboxIcon,
  MessageSquareIcon,
  RocketIcon,
  ZapIcon,
} from "lucide-react"

import { Reveal } from "@/components/reveal"
import { Section } from "@/components/section"
import { cn } from "@/lib/utils"

/** What GitHub's notifications look like: releases buried among everything else. */
const NOISE = [
  { icon: GitPullRequestIcon, text: "Review requested: Bump eslint to 9.38", release: false },
  { icon: RocketIcon, text: "acme/app released web@2.0.0", release: true },
  { icon: MessageSquareIcon, text: "New comment on #4182", release: false },
  { icon: CircleDotIcon, text: "Issue opened: Crash on start", release: false },
  { icon: RocketIcon, text: "acme/app released web@1.9.3", release: true },
  { icon: GitPullRequestIcon, text: "PR merged: Update README", release: false },
  { icon: RocketIcon, text: "acme/tool released v3.0.0-rc.1", release: true },
  { icon: MessageSquareIcon, text: "Mentioned in a discussion", release: false },
] as const

/** The same releases in the inbox: one entry per repository. */
const INBOX = [
  { repository: "acme/app", version: "web@2.0.0", older: 1, badge: "Breaking" },
  { repository: "acme/tool", version: "v3.0.0-rc.1", older: 0, badge: "Pre-release" },
  { repository: "acme/cli", version: "v4.2.0", older: 3, badge: null },
] as const

const STEPS = [
  {
    icon: EyeIcon,
    title: "Watch on GitHub",
    text: "Subscribe to the releases of any repository, as you already do. Releases reads your notifications.",
  },
  {
    icon: InboxIcon,
    title: "Collect in one inbox",
    text: "Only releases make it in, newest first, one entry per repository, with what changed since you last looked.",
  },
  {
    icon: ZapIcon,
    title: "Triage in seconds",
    text: "Read, snooze, hide a component or unsubscribe with a click, a swipe or a key. GitHub stays in sync.",
  },
] as const

export function HowItWorks() {
  return (
    <Section
      id="how-it-works"
      eyebrow="How it works"
      title="From notification noise to a clear signal"
      description="GitHub mixes releases with reviews, comments and issues. Releases keeps only what shipped and lays it out like an inbox you actually want to open."
    >
      <Reveal className="grid items-center gap-6 lg:grid-cols-[1fr_auto_1fr]">
        <div className="edge-highlight relative overflow-hidden rounded-2xl border bg-card p-2">
          <p className="px-3 pt-2 pb-3 text-xs font-medium text-muted-foreground">
            GitHub notifications
          </p>
          <ul className="mask-fade-y space-y-1">
            {NOISE.map(({ icon: Icon, text, release }) => (
              <li
                key={text}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm",
                  release ? "bg-brand/10 text-foreground" : "text-muted-foreground/70"
                )}
              >
                <Icon className={cn("size-4 shrink-0", release && "text-brand")} />
                <span className="truncate">{text}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex justify-center">
          <span className="flex size-11 items-center justify-center rounded-full border bg-background shadow-sm">
            <ArrowRightIcon className="size-5 rotate-90 text-brand lg:rotate-0" />
          </span>
        </div>

        <div className="edge-highlight overflow-hidden rounded-2xl border bg-card p-2">
          <div className="flex items-center gap-2 px-3 pt-2 pb-3 text-xs font-medium">
            <InboxIcon className="size-3.5" /> Inbox
            <span className="rounded-full bg-brand px-1.5 py-px font-mono text-[10px] text-white">
              3
            </span>
          </div>
          <ul className="space-y-1">
            {INBOX.map((entry) => (
              <li key={entry.repository} className="rounded-lg px-3 py-2.5 hover:bg-muted/60">
                <p className="text-xs text-muted-foreground">{entry.repository}</p>
                <div className="mt-0.5 flex flex-wrap items-center gap-2">
                  <span className="font-medium">{entry.version}</span>
                  {entry.badge === "Breaking" && (
                    <span className="flex items-center gap-1 rounded-md bg-destructive/10 px-1.5 py-px text-xs text-destructive">
                      <ZapIcon className="size-3" /> Breaking
                    </span>
                  )}
                  {entry.badge === "Pre-release" && (
                    <span className="rounded-md border px-1.5 py-px text-xs">Pre-release</span>
                  )}
                  {entry.older > 0 && (
                    <span className="rounded-md bg-muted px-1.5 py-px text-xs">
                      +{entry.older} older
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </Reveal>

      <div className="mt-14 grid gap-8 sm:grid-cols-3">
        {STEPS.map(({ icon: Icon, title, text }, index) => (
          <Reveal key={title} delay={index * 100} className="relative">
            <div className="mb-4 flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-lg bg-brand/10 text-brand">
                <Icon className="size-4.5" />
              </span>
              <span className="font-mono text-xs text-muted-foreground">0{index + 1}</span>
            </div>
            <h3 className="font-semibold">{title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p>
          </Reveal>
        ))}
      </div>
    </Section>
  )
}
