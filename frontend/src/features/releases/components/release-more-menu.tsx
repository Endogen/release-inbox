import { BookMarkedIcon, EllipsisIcon, EyeOffIcon, LinkIcon, TagIcon } from "lucide-react"

import { Hint } from "@/components/hint"
import { MenuKeyHint } from "@/components/key-hint"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { Release } from "@/lib/api/types"
import { HOTKEYS } from "@/lib/hotkeys"

interface ReleaseMoreMenuProps {
  release: Release
  onCopyLink: () => void
  onHide: () => void
}

/** The less frequent actions of a release: links to GitHub and hiding. */
export function ReleaseMoreMenu({ release, onCopyLink, onHide }: ReleaseMoreMenuProps) {
  const { repository } = release
  return (
    <DropdownMenu>
      <Hint label="More actions">
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label="More actions">
            <EllipsisIcon />
          </Button>
        </DropdownMenuTrigger>
      </Hint>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuGroup>
          <DropdownMenuItem asChild>
            <a href={release.html_url} target="_blank" rel="noopener noreferrer">
              <TagIcon />
              Open release
              <MenuKeyHint hotkey={HOTKEYS.open} />
            </a>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <a href={repository.html_url} target="_blank" rel="noopener noreferrer">
              <BookMarkedIcon />
              Open repository
            </a>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onCopyLink}>
            <LinkIcon />
            Copy link to release
            <MenuKeyHint hotkey={HOTKEYS.copyLink} />
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onSelect={onHide}>
            <EyeOffIcon />
            Hide releases like this…
            <MenuKeyHint hotkey={HOTKEYS.hide} />
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
