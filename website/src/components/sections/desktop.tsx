import { BellIcon, CheckIcon, LogInIcon, MonitorDownIcon, PanelTopIcon } from "lucide-react"

import { LogoMark } from "@/components/logo"
import { Reveal } from "@/components/reveal"
import { Section } from "@/components/section"
import { cn } from "@/lib/utils"

const POINTS = [
  {
    icon: PanelTopIcon,
    title: "Lives in the tray",
    text: "Close the window and Releases keeps running; a dot on the tray icon says the inbox has entries.",
  },
  {
    icon: BellIcon,
    title: "Notifications with buttons",
    text: "Mark as read, snooze until tomorrow or mute the repository, right from the notification.",
  },
  {
    icon: LogInIcon,
    title: "Starts at login",
    text: "Optional: it starts hidden in the tray, so nothing slips by after a restart.",
  },
  {
    icon: MonitorDownIcon,
    title: "Light and native",
    text: "A few megabytes, built with Tauri on the system's web view. No bundled browser.",
  },
] as const

const MENU = [
  { label: "Open Releases" },
  { label: "Sync now" },
  { label: "Reload" },
  { separator: true },
  { label: "Start at login", checked: true },
  { label: "Change server…" },
  { separator: true },
  { label: "Quit Releases" },
] as const

export function Desktop() {
  return (
    <Section id="desktop" className="overflow-x-clip">
      <div className="grid items-center gap-14 lg:grid-cols-2">
        <Reveal>
          <p className="mb-3 font-mono text-xs font-medium tracking-widest text-brand uppercase">
            Desktop app
          </p>
          <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            Your inbox, one click away on every desktop
          </h2>
          <p className="mt-4 text-lg text-pretty text-muted-foreground">
            The app for Windows, macOS and Linux opens your server&apos;s inbox in its own window
            and brings its notifications to your desktop, without a browser tab left open.
          </p>
          <dl className="mt-10 grid gap-6 sm:grid-cols-2">
            {POINTS.map(({ icon: Icon, title, text }) => (
              <div key={title}>
                <dt className="flex items-center gap-2 text-sm font-semibold">
                  <Icon className="size-4 text-brand" />
                  {title}
                </dt>
                <dd className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{text}</dd>
              </div>
            ))}
          </dl>
        </Reveal>

        <Reveal delay={150} className="relative mx-auto w-full max-w-md">
          <div aria-hidden className="bg-aurora absolute -inset-20 opacity-80" />

          {/* A desktop notification, as the operating system shows it. */}
          <div className="animate-float relative rounded-2xl border bg-popover/90 p-4 shadow-2xl backdrop-blur-xl">
            <div className="flex gap-3">
              <LogoMark className="size-9 rounded-lg" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold">acme/app</p>
                  <span className="text-xs text-muted-foreground">now</span>
                </div>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  web@2.0.0 was released · may contain breaking changes
                </p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-1.5">
              {["Mark as read", "Snooze until tomorrow", "Mute repository"].map((label, index) => (
                <span
                  key={label}
                  className={cn(
                    "flex items-center justify-center rounded-lg px-2 py-1.5 text-center text-xs font-medium",
                    index === 0 ? "bg-primary text-primary-foreground" : "bg-muted"
                  )}
                >
                  {label}
                </span>
              ))}
            </div>
          </div>

          {/* The tray menu above the taskbar. */}
          <div className="relative mt-6 ml-auto w-60 rounded-xl border bg-popover p-1 text-sm shadow-2xl">
            {MENU.map((item, index) =>
              "separator" in item ? (
                <div key={index} className="my-1 h-px bg-border" />
              ) : (
                <div
                  key={item.label}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-2.5 py-1.5",
                    index === 0 && "bg-accent text-accent-foreground"
                  )}
                >
                  <span className="flex w-4 justify-center">
                    {"checked" in item && <CheckIcon className="size-3.5" />}
                  </span>
                  {item.label}
                </div>
              )
            )}
          </div>
          <div className="relative mt-3 ml-auto flex w-60 items-center justify-end gap-3 rounded-lg border bg-muted/60 px-3 py-2">
            <span className="text-xs text-muted-foreground">14:02</span>
            <span className="relative">
              <LogoMark className="size-5" />
              <span className="absolute -right-0.5 -bottom-0.5 size-2 rounded-full bg-[#e5484d] ring-2 ring-muted" />
            </span>
          </div>
        </Reveal>
      </div>
    </Section>
  )
}
