import {
  DownloadIcon,
  FileArchiveIcon,
  FileCodeIcon,
  FileIcon,
  PackageIcon,
  ShieldCheckIcon,
  type LucideIcon,
} from "lucide-react"
import { useMemo, type ComponentProps } from "react"

import { Hint } from "@/components/hint"
import { Button } from "@/components/ui/button"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useMediaQuery } from "@/hooks/use-media-query"
import type { Release, ReleaseAsset } from "@/lib/api/types"
import { MEDIA } from "@/lib/breakpoints"
import { formatFileSize } from "@/lib/file-size"

import {
  assetForDevice,
  classifyAsset,
  detectPlatform,
  PLATFORM_LABELS,
  sortAssets,
  sourceArchives,
  type ClassifiedAsset,
} from "../release-assets"

const KIND_ICONS: Record<ClassifiedAsset["kind"], LucideIcon> = {
  installer: PackageIcon,
  archive: FileArchiveIcon,
  verification: ShieldCheckIcon,
  other: FileIcon,
}

interface DownloadEntry {
  key: string
  label: string
  detail: string | null
  url: string
  icon: LucideIcon
}

interface DownloadSections {
  forDevice: DownloadEntry | undefined
  files: DownloadEntry[]
  source: DownloadEntry[]
}

function entry(item: ClassifiedAsset): DownloadEntry {
  const platform = item.platform ? PLATFORM_LABELS[item.platform] : null
  return {
    key: String(item.asset.id),
    label: item.asset.name,
    detail: [platform, formatFileSize(item.asset.size)].filter(Boolean).join(" · "),
    url: item.asset.url,
    icon: KIND_ICONS[item.kind],
  }
}

function useDownloadSections(release: Release, assets: readonly ReleaseAsset[]): DownloadSections {
  return useMemo(() => {
    const classified = assets.map(classifyAsset)
    const suggested = assetForDevice(classified, detectPlatform(navigator.userAgent))
    return {
      forDevice: suggested && entry(suggested),
      files: sortAssets(classified).map(entry),
      source: sourceArchives(release.repository.html_url, release.tag_name).map((archive) => ({
        key: archive.url,
        label: archive.label,
        detail: null,
        url: archive.url,
        icon: FileCodeIcon,
      })),
    }
  }, [release.repository.html_url, release.tag_name, assets])
}

/**
 * The files attached to a release: a drawer from the bottom on phones, a menu elsewhere. The
 * file that matches this device comes first.
 */
export function ReleaseDownloads({
  release,
  assets,
  showCount = true,
}: {
  release: Release
  assets: readonly ReleaseAsset[]
  /** Show the number of files next to the icon; the label always has it. */
  showCount?: boolean
}) {
  const sections = useDownloadSections(release, assets)
  const phone = !useMediaQuery(MEDIA.sm)
  const label = `Download files (${assets.length})`
  const trigger = (
    <Button variant="outline" size={showCount ? "sm" : "icon-sm"} aria-label={label}>
      <DownloadIcon data-icon={showCount ? "inline-start" : undefined} />
      {showCount && assets.length}
    </Button>
  )

  if (phone) {
    return (
      <Drawer>
        <DrawerTrigger asChild>{trigger}</DrawerTrigger>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Download</DrawerTitle>
            <DrawerDescription>Files of {release.tag_name}</DrawerDescription>
          </DrawerHeader>
          <div className="flex max-h-[60dvh] flex-col gap-4 overflow-y-auto px-4 pb-6">
            {sections.forDevice && (
              <DrawerSection title="For this device" entries={[sections.forDevice]} highlight />
            )}
            <DrawerSection title="All files" entries={sections.files} />
            <DrawerSection title="Source code" entries={sections.source} />
          </div>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <DropdownMenu>
      <Hint label={label}>
        <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      </Hint>
      <DropdownMenuContent
        align="start"
        className="max-h-96 w-96 max-w-[calc(100vw-2rem)] overflow-y-auto"
      >
        {sections.forDevice && (
          <>
            <MenuSection title="For this device" entries={[sections.forDevice]} />
            <DropdownMenuSeparator />
          </>
        )}
        <MenuSection title="All files" entries={sections.files} />
        <DropdownMenuSeparator />
        <MenuSection title="Source code" entries={sections.source} />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function MenuSection({ title, entries }: { title: string; entries: DownloadEntry[] }) {
  return (
    <DropdownMenuGroup>
      <DropdownMenuLabel>{title}</DropdownMenuLabel>
      {entries.map((entry) => (
        <DropdownMenuItem key={entry.key} asChild>
          <DownloadLink entry={entry} />
        </DropdownMenuItem>
      ))}
    </DropdownMenuGroup>
  )
}

function DrawerSection({
  title,
  entries,
  highlight = false,
}: {
  title: string
  entries: DownloadEntry[]
  highlight?: boolean
}) {
  return (
    <section className="flex flex-col gap-1">
      <h3 className="px-2 text-xs font-medium text-muted-foreground">{title}</h3>
      <ul className="flex flex-col">
        {entries.map((entry) => (
          <li key={entry.key}>
            <Button
              asChild
              variant={highlight ? "secondary" : "ghost"}
              className="h-auto w-full justify-start gap-3 py-2.5"
            >
              <DownloadLink entry={entry} />
            </Button>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** A file's name and details, linking to it; styled by the menu item or button around it. */
function DownloadLink({ entry, ...props }: { entry: DownloadEntry } & ComponentProps<"a">) {
  const { label, detail, url, icon: Icon } = entry
  return (
    <a href={url} download {...props}>
      <Icon data-icon="inline-start" />
      <span className="flex min-w-0 flex-col text-left">
        <span className="truncate font-mono text-xs">{label}</span>
        {detail && <span className="text-xs font-normal text-muted-foreground">{detail}</span>}
      </span>
    </a>
  )
}
