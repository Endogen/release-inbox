import type { ReactNode } from "react"

import { KeyHint } from "@/components/key-hint"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

interface HintProps {
  label: ReactNode
  /** The keyboard shortcut of the same action, shown after the label. */
  hotkey?: string
  /** The element the hint is about; it must pass on props and its ref, like a Button. */
  children: ReactNode
  className?: string
}

/** A tooltip on hover and keyboard focus. */
export function Hint({ label, hotkey, children, className }: HintProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent className={className}>
        {label}
        {hotkey && <KeyHint hotkey={hotkey} />}
      </TooltipContent>
    </Tooltip>
  )
}
