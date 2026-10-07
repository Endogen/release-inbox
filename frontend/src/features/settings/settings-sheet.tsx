import { ArrowLeftIcon, XIcon } from "lucide-react"
import { useRef } from "react"

import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

import { DisplayOptions } from "./display-options"
import { InboxSettings } from "./inbox-settings"
import { NotificationSettings } from "./notification-settings"

interface SettingsSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** A panel on larger screens; a page with a back button on phones. */
export function SettingsSheet({ open, onOpenChange }: SettingsSheetProps) {
  const contentRef = useRef<HTMLDivElement>(null)
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        ref={contentRef}
        showCloseButton={false}
        // Focus the panel, not its first button: a highlighted back button looks pressed.
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          contentRef.current?.focus()
        }}
        className="gap-0 outline-none data-[side=right]:w-full data-[side=right]:sm:max-w-md"
      >
        <SheetHeader className="flex-row items-center gap-2 border-b max-sm:py-3 max-sm:pl-2">
          <SheetClose asChild>
            <Button variant="ghost" size="icon-sm" aria-label="Back" className="sm:hidden">
              <ArrowLeftIcon />
            </Button>
          </SheetClose>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <SheetTitle>Settings</SheetTitle>
            <SheetDescription className="max-sm:sr-only">
              Notifications, your inbox and how the app looks.
            </SheetDescription>
          </div>
          <SheetClose asChild>
            <Button variant="ghost" size="icon-sm" aria-label="Close" className="max-sm:hidden">
              <XIcon />
            </Button>
          </SheetClose>
        </SheetHeader>
        <div className="flex flex-1 flex-col gap-8 overflow-y-auto p-4">
          <NotificationSettings />
          <Separator />
          <InboxSettings />
          <Separator />
          <DisplayOptions />
        </div>
      </SheetContent>
    </Sheet>
  )
}
