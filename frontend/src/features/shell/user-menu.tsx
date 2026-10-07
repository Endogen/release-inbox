import { KeyboardIcon, LogOutIcon, SettingsIcon } from "lucide-react"

import { UserAvatar } from "@/components/avatars"
import { MenuKeyHint } from "@/components/key-hint"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useLogout } from "@/features/auth/api"
import { HOTKEYS } from "@/lib/hotkeys"

interface UserMenuProps {
  username: string
  onOpenSettings: () => void
  onOpenShortcuts: () => void
}

export function UserMenu({ username, onOpenSettings, onOpenShortcuts }: UserMenuProps) {
  const logout = useLogout()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Account menu" className="rounded-full">
          <UserAvatar login={username} avatarUrl={null} className="size-8" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Signed in as {username}</DropdownMenuLabel>
          <DropdownMenuItem onSelect={onOpenSettings}>
            <SettingsIcon />
            Settings
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onOpenShortcuts} className="pointer-coarse:hidden">
            <KeyboardIcon />
            Keyboard shortcuts
            <MenuKeyHint hotkey={HOTKEYS.help} />
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onSelect={() => logout.mutate()}>
            <LogOutIcon />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
