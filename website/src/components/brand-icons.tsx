import { siApple, siGithub, siLinux } from "simple-icons"

import type { Platform } from "@/lib/releases"
import { cn } from "@/lib/utils"

type IconProps = { className?: string }

function SimpleIcon({ path, className }: IconProps & { path: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={cn("size-4", className)}>
      <path d={path} />
    </svg>
  )
}

export function GitHubIcon(props: IconProps) {
  return <SimpleIcon path={siGithub.path} {...props} />
}

export function AppleIcon(props: IconProps) {
  return <SimpleIcon path={siApple.path} {...props} />
}

export function LinuxIcon(props: IconProps) {
  return <SimpleIcon path={siLinux.path} {...props} />
}

/** The four panes of the Windows logo. */
export function WindowsIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={cn("size-4", className)}>
      <path d="M2 4.3 10 3.2v7.8H2zM11 3.1 22 1.5V11H11zM2 12h8v7.8l-8-1.1zM11 12h11v9.5l-11-1.6z" />
    </svg>
  )
}

export const PLATFORM_ICONS: Record<Platform, (props: IconProps) => React.JSX.Element> = {
  windows: WindowsIcon,
  macos: AppleIcon,
  linux: LinuxIcon,
}
