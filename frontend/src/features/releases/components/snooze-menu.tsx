import { AlarmClockIcon } from "lucide-react"
import { useMemo, type ReactNode } from "react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useNow } from "@/hooks/use-now"
import { formatWeekdayTime } from "@/lib/time"

import { snoozeOptions } from "../snooze-times"

interface SnoozeMenuProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSnooze: (until: Date) => void
  /** Wraps the trigger, e.g. in a tooltip. */
  renderTrigger?: (trigger: ReactNode) => ReactNode
}

export function SnoozeMenu({ open, onOpenChange, onSnooze, renderTrigger }: SnoozeMenuProps) {
  const now = useNow()
  const options = useMemo(() => snoozeOptions(new Date(now)), [now])
  const trigger = (
    <DropdownMenuTrigger asChild>
      <Button size="sm" variant="outline">
        <AlarmClockIcon data-icon="inline-start" />
        Snooze
      </Button>
    </DropdownMenuTrigger>
  )

  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      {renderTrigger ? renderTrigger(trigger) : trigger}
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Back in the inbox</DropdownMenuLabel>
          {options.map((option) => (
            <DropdownMenuItem key={option.id} onSelect={() => onSnooze(option.until)}>
              {option.label}
              <DropdownMenuShortcut>{formatWeekdayTime(option.until)}</DropdownMenuShortcut>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
