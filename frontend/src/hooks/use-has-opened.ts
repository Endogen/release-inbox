import { useState } from "react"

/**
 * Whether ``open`` has been true at least once. Lets dialogs load on first use and stay
 * mounted afterwards, so they can animate out.
 */
export function useHasOpened(open: boolean): boolean {
  const [opened, setOpened] = useState(open)
  if (open && !opened) setOpened(true)
  return opened || open
}
