import { BookMarkedIcon, EllipsisIcon, EyeOffIcon, TagIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { Release } from "@/lib/api/types"

import { HOTKEYS } from "../shortcuts"

interface ReleaseMoreMenuProps {
  release: Release
  onHide: () => void
}

/** The less frequent actions of a release: links to GitHub and hiding. */
export function ReleaseMoreMenu({ release, onHide }: ReleaseMoreMenuProps) {
  const { repository } = release
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="More actions">
              <EllipsisIcon />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>More actions</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuGroup>
          <DropdownMenuItem asChild>
            <a href={release.html_url} target="_blank" rel="noopener noreferrer">
              <TagIcon />
              Open release
              <Shortcut keyName={HOTKEYS.open} />
            </a>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <a href={repository.html_url} target="_blank" rel="noopener noreferrer">
              <BookMarkedIcon />
              Open repository
            </a>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onSelect={onHide}>
            <EyeOffIcon />
            Hide releases like this…
            <Shortcut keyName={HOTKEYS.hide} />
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Keyboard hints only help where there is a keyboard. */
function Shortcut({ keyName }: { keyName: string }) {
  return <DropdownMenuShortcut className="pointer-coarse:hidden">{keyName}</DropdownMenuShortcut>
}
