import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

import { HideRuleSettings } from "./hide-rule-settings"
import { MutedRepositorySettings } from "./muted-repository-settings"
import { NotificationSettings } from "./notification-settings"
import { PrereleaseSettings } from "./prerelease-settings"
import { SyncSettings } from "./sync-settings"

interface SettingsSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SettingsSheet({ open, onOpenChange }: SettingsSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-md">
        <SheetHeader className="border-b">
          <SheetTitle>Settings</SheetTitle>
          <SheetDescription>
            Notifications, pre-releases, hidden components and sync.
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-1 flex-col gap-8 overflow-y-auto p-4">
          <NotificationSettings />
          <MutedRepositorySettings />
          <Separator />
          <PrereleaseSettings />
          <Separator />
          <HideRuleSettings />
          <Separator />
          <SyncSettings />
        </div>
      </SheetContent>
    </Sheet>
  )
}
