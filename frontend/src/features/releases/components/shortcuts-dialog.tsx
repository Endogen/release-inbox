import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { KeyHint } from "@/components/key-hint"
import { KbdGroup } from "@/components/ui/kbd"

import { SHORTCUTS } from "../shortcuts"

interface ShortcutsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ShortcutsDialog({ open, onOpenChange }: ShortcutsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>Work through your releases without the mouse.</DialogDescription>
        </DialogHeader>
        <dl className="flex flex-col">
          {SHORTCUTS.map(({ keys, description }) => (
            <div
              key={description}
              className="flex items-center justify-between border-b py-2.5 text-sm last:border-b-0"
            >
              <dt className="text-muted-foreground">{description}</dt>
              <dd>
                <KbdGroup>
                  {keys.map((key) => (
                    <KeyHint key={key} hotkey={key} />
                  ))}
                </KbdGroup>
              </dd>
            </div>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
  )
}
