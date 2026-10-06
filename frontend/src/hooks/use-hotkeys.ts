import { useEffect } from "react"

import { useLatest } from "./use-latest"

const OVERLAY_SELECTOR =
  "[role=dialog][data-state=open], [role=alertdialog], [role=menu], [role=listbox]"

type HotkeyMap = Partial<Record<string, () => void>>

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    // Comboboxes (e.g. the version picker) use typed characters for type-ahead.
    target.closest("[role=combobox]") !== null
  )
}

/**
 * Single-key shortcuts (matched against `KeyboardEvent.key`), ignored while typing in a field,
 * while a dialog or menu is open, or when a modifier other than Shift is held.
 */
export function useHotkeys(
  hotkeys: HotkeyMap,
  {
    repeatable = [],
  }: {
    /** Keys that keep firing while held down; all others fire once per press. */
    repeatable?: readonly string[]
  } = {}
): void {
  const latest = useLatest(hotkeys)
  const repeatableRef = useLatest(repeatable)

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return
      if (isTypingTarget(event.target)) return
      if (document.querySelector(OVERLAY_SELECTOR)) return
      if (event.repeat && !repeatableRef.current.includes(event.key)) return

      const handler = latest.current[event.key]
      if (handler) {
        event.preventDefault()
        handler()
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [latest, repeatableRef])
}
