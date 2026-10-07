import { DropdownMenuShortcut } from "@/components/ui/dropdown-menu"
import { Kbd } from "@/components/ui/kbd"
import { keyLabel } from "@/lib/hotkeys"

// Keyboard hints only help where there is a keyboard, so touch screens don't show them.

/** A key of a keyboard shortcut, e.g. in a tooltip. */
export function KeyHint({ hotkey }: { hotkey: string }) {
  return <Kbd className="pointer-coarse:hidden">{keyLabel(hotkey)}</Kbd>
}

/** The shortcut of a menu item, at its end. */
export function MenuKeyHint({ hotkey }: { hotkey: string }) {
  return (
    <DropdownMenuShortcut className="pointer-coarse:hidden">
      {keyLabel(hotkey)}
    </DropdownMenuShortcut>
  )
}
