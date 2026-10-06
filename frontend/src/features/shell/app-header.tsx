import { SettingsIcon } from "lucide-react"
import type { ReactNode } from "react"

import { BrandMark } from "@/components/brand-mark"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { UserMenu } from "./user-menu"
import { SyncButton } from "@/features/sync/sync-button"

interface AppHeaderProps {
  username: string
  search: ReactNode
  onOpenSettings: () => void
  onOpenShortcuts: () => void
}

export function AppHeader({ username, search, onOpenSettings, onOpenShortcuts }: AppHeaderProps) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-4 border-b bg-background/80 px-4 backdrop-blur supports-backdrop-filter:bg-background/60">
      <div className="flex items-center gap-2.5">
        <BrandMark />
        <span className="hidden text-sm font-semibold tracking-tight sm:inline">Releases</span>
      </div>
      <div className="mx-auto w-full max-w-xl">{search}</div>
      <div className="flex items-center gap-1">
        <SyncButton />
        <Tooltip>
          <TooltipTrigger asChild>
            {/* On phones the account menu offers Settings, leaving room for the search. */}
            <Button
              variant="ghost"
              size="icon"
              aria-label="Settings"
              onClick={onOpenSettings}
              className="hidden sm:inline-flex"
            >
              <SettingsIcon />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Settings</TooltipContent>
        </Tooltip>
        <UserMenu
          username={username}
          onOpenSettings={onOpenSettings}
          onOpenShortcuts={onOpenShortcuts}
        />
      </div>
    </header>
  )
}
