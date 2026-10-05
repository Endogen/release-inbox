import { useEffect, useRef } from "react"

const OVERLAY_SELECTOR = "[role=dialog][data-state=open], [role=alertdialog], [role=menu], [role=listbox]"

export type HotkeyMap = Partial<Record<string, (event: KeyboardEvent) => void>>

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  )
}

/**
 * Single-key shortcuts (matched against `KeyboardEvent.key`), ignored while typing in a field,
 * while a dialog or menu is open, or when a modifier other than Shift is held.
 */
export function useHotkeys(hotkeys: HotkeyMap, enabled = true): void {
  const latest = useRef(hotkeys)

  useEffect(() => {
    latest.current = hotkeys
  })

  useEffect(() => {
    if (!enabled) return

    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return
      if (isTypingTarget(event.target)) return
      if (document.querySelector(OVERLAY_SELECTOR)) return

      const handler = latest.current[event.key]
      if (handler) {
        event.preventDefault()
        handler(event)
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [enabled])
}
