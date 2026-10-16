import {
  AlarmClockIcon,
  BellRingIcon,
  DownloadIcon,
  EyeOffIcon,
  FlaskConicalIcon,
  GlobeIcon,
  KeyboardIcon,
  MonitorIcon,
  RadioIcon,
  RefreshCwIcon,
  SearchIcon,
  SendIcon,
  SmartphoneIcon,
  SparklesIcon,
  StarIcon,
  ZapIcon,
} from "lucide-react"
import Image, { type StaticImageData } from "next/image"
import type { ReactNode } from "react"

import hideComponent from "@/assets/screenshots/hide-component.webp"
import mobileSwipe from "@/assets/screenshots/mobile-swipe.webp"
import whatsNewLight from "@/assets/screenshots/whats-new-light.webp"
import { Reveal } from "@/components/reveal"
import { Section } from "@/components/section"
import { cn } from "@/lib/utils"

function Card({
  title,
  text,
  icon: Icon,
  className,
  children,
  delay = 0,
}: {
  title: string
  text: string
  icon: typeof ZapIcon
  className?: string
  children?: ReactNode
  delay?: number
}) {
  return (
    <Reveal
      delay={delay}
      className={cn(
        "edge-highlight group relative flex flex-col overflow-hidden rounded-2xl border bg-card transition-[border-color,transform] duration-300 hover:-translate-y-0.5 hover:border-brand/30",
        className
      )}
    >
      <div className="p-6 sm:p-7">
        <Icon className="mb-4 size-5 text-brand" />
        <h3 className="font-semibold tracking-tight">{title}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{text}</p>
      </div>
      {children && <div className="relative mt-auto">{children}</div>}
    </Reveal>
  )
}

function Screenshot({ src, alt, className }: { src: StaticImageData; alt: string; className?: string }) {
  return (
    <div className="pl-6 sm:pl-7">
      <Image
        src={src}
        alt={alt}
        sizes="(min-width: 1024px) 700px, 100vw"
        className={cn(
          "rounded-tl-xl border-t border-l object-cover object-left-top shadow-lg transition-transform duration-500 group-hover:scale-[1.015]",
          className
        )}
      />
    </div>
  )
}

const RELEASES = [
  { version: "v3.0.0", note: "Major version", tone: "breaking" },
  { version: "web@2.4.0", note: "“BREAKING: config moved”", tone: "breaking" },
  { version: "v2.1.0-beta.2", note: "Pre-release", tone: "pre" },
  { version: "v2.0.9", note: "Bug fixes", tone: "plain" },
] as const

const SNOOZE = [
  { label: "Later today", time: "18:00" },
  { label: "Tomorrow", time: "Fri 09:00" },
  { label: "This weekend", time: "Sat 09:00" },
  { label: "Next week", time: "Mon 09:00" },
] as const

const CHANNELS = [
  { icon: GlobeIcon, label: "Browser push" },
  { icon: BellRingIcon, label: "ntfy" },
  { icon: SendIcon, label: "Telegram" },
  { icon: MonitorIcon, label: "Desktop app" },
] as const

const KEYS = [
  { key: "j", label: "next" },
  { key: "k", label: "previous" },
  { key: "e", label: "read" },
  { key: "s", label: "snooze" },
  { key: "h", label: "hide" },
  { key: "/", label: "search" },
] as const

const MORE = [
  { icon: RadioIcon, title: "Live updates", text: "Polls GitHub every minute; open tabs update instantly." },
  { icon: RefreshCwIcon, title: "Synced read state", text: "Marking as read also marks the thread on github.com." },
  { icon: SearchIcon, title: "Search", text: "Across repositories, release names, tags and notes." },
  { icon: StarIcon, title: "Star counts", text: "Next to every repository, refreshed daily." },
  { icon: FlaskConicalIcon, title: "Pre-releases your way", text: "Like other releases, quiet, or out of sight." },
  { icon: DownloadIcon, title: "Release files", text: "Download assets, with the file for your device first." },
  { icon: SmartphoneIcon, title: "Installable", text: "A web app for phones, with the inbox count on its icon." },
  { icon: EyeOffIcon, title: "Read as you go", text: "Optionally mark a release read when you move on." },
] as const

export function Features() {
  return (
    <Section
      id="features"
      eyebrow="Features"
      title="Everything a release deserves, nothing it doesn't"
      description="Built for people who follow dozens of projects: fast to scan, honest about what changed, and quick to clear."
    >
      <div className="grid gap-4 md:grid-cols-6">
        <Card
          icon={SparklesIcon}
          title="What's new, all in one place"
          text="Missed three releases of a project? What's new combines the notes of every unread release, so nothing between your last visit and today slips through."
          className="md:col-span-4"
        >
          <Screenshot
            src={whatsNewLight}
            alt="What's new: the notes of every unread release of one repository"
            className="aspect-[16/8]"
          />
        </Card>

        <Card
          icon={ZapIcon}
          title="Breaking changes stand out"
          text="Releases that mention breaking changes, or are a new major version, get a badge."
          className="md:col-span-2"
          delay={80}
        >
          <ul className="space-y-2 px-6 pb-6 sm:px-7">
            {RELEASES.map((release) => (
              <li
                key={release.version}
                className="flex items-center justify-between gap-3 rounded-lg border bg-background/60 px-3 py-2"
              >
                <span className="truncate font-mono text-xs">{release.version}</span>
                {release.tone === "breaking" ? (
                  <span className="flex shrink-0 items-center gap-1 rounded-md bg-destructive/10 px-1.5 py-px text-xs text-destructive">
                    <ZapIcon className="size-3" /> Breaking
                  </span>
                ) : release.tone === "pre" ? (
                  <span className="shrink-0 rounded-md border px-1.5 py-px text-xs">Pre-release</span>
                ) : (
                  <span className="shrink-0 text-xs text-muted-foreground">{release.note}</span>
                )}
              </li>
            ))}
          </ul>
        </Card>

        <Card
          icon={AlarmClockIcon}
          title="Snooze for later"
          text="Put a release aside; it comes back to the inbox with a reminder."
          className="md:col-span-2"
        >
          <div className="mx-6 mb-6 overflow-hidden rounded-xl border bg-popover p-1 shadow-lg sm:mx-7">
            {SNOOZE.map((option, index) => (
              <div
                key={option.label}
                className={cn(
                  "flex items-center justify-between rounded-md px-3 py-2 text-sm",
                  index === 1 && "bg-accent text-accent-foreground"
                )}
              >
                {option.label}
                <span className="font-mono text-xs text-muted-foreground">{option.time}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card
          icon={EyeOffIcon}
          title="Hide the parts you don't use"
          text="Follow a monorepo but not all of it: hide a component such as web@* without unsubscribing. The pattern is suggested, the preview shows what goes."
          className="md:col-span-4"
          delay={80}
        >
          <Screenshot
            src={hideComponent}
            alt="The hide dialog with a suggested pattern and the matching releases"
            className="aspect-[16/7]"
          />
        </Card>

        <Card
          icon={BellRingIcon}
          title="Notified where you are"
          text="Every repository you watch notifies you; mute one, or only hear about breaking changes."
          className="md:col-span-2"
        >
          <div className="flex flex-wrap gap-2 px-6 pb-6 sm:px-7">
            {CHANNELS.map(({ icon: Icon, label }) => (
              <span
                key={label}
                className="flex items-center gap-1.5 rounded-full border bg-background/60 px-3 py-1.5 text-xs"
              >
                <Icon className="size-3.5 text-brand" />
                {label}
              </span>
            ))}
          </div>
        </Card>

        <Card
          icon={KeyboardIcon}
          title="Keyboard first"
          text="Fly through the inbox without the mouse; ? lists every shortcut."
          className="md:col-span-2"
          delay={80}
        >
          <div className="grid grid-cols-3 gap-2 px-6 pb-6 sm:px-7">
            {KEYS.map(({ key, label }, index) => (
              <div key={key} className="flex flex-col items-center gap-1">
                <kbd
                  className="animate-key flex size-10 items-center justify-center rounded-lg border bg-background font-mono text-sm shadow-[inset_0_-2px_0_var(--border)]"
                  style={{ animationDelay: `${index * 0.8}s` }}
                >
                  {key}
                </kbd>
                <span className="text-[11px] text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card
          icon={SparklesIcon}
          title="AI summaries on request"
          text="Summarise a release, or everything new in a repository, with Claude. Cached, and only when you ask."
          className="md:col-span-2"
          delay={160}
        >
          <div className="mx-6 mb-6 space-y-2 rounded-xl border bg-background/60 p-4 sm:mx-7">
            <p className="flex items-center gap-1.5 text-xs font-medium text-brand">
              <SparklesIcon className="size-3.5" /> Summary
            </p>
            {["w-full", "w-11/12", "w-4/5", "w-2/3"].map((width) => (
              <div key={width} className={cn("h-2 animate-blink rounded-full bg-muted", width)} />
            ))}
          </div>
        </Card>

        <Card
          icon={SmartphoneIcon}
          title="Swipe to triage on your phone"
          text="Swipe left to mark as read, right to unsubscribe. Every action, swiped, clicked or typed, offers Undo, and GitHub only hears about it once the toast is gone."
          className="md:col-span-6 md:grid md:grid-cols-[1fr_auto] md:items-center"
        >
          <div className="flex h-72 justify-center overflow-hidden px-6 md:h-80 md:pr-16 md:pl-0">
            <div className="mt-2 h-fit w-52 overflow-hidden rounded-t-[2rem] border-x-[6px] border-t-[6px] border-foreground/85 shadow-2xl md:mt-10 md:w-60">
              <Image src={mobileSwipe} alt="Swiping an entry to mark it as read" sizes="240px" />
            </div>
          </div>
        </Card>
      </div>

      <div className="mt-16 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
        {MORE.map(({ icon: Icon, title, text }, index) => (
          <Reveal key={title} delay={(index % 4) * 70} className="flex gap-3">
            <Icon className="mt-0.5 size-4.5 shrink-0 text-brand" />
            <div>
              <h3 className="text-sm font-semibold">{title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{text}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  )
}
