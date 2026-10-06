import {
  AlarmClockIcon,
  ArchiveIcon,
  EyeOffIcon,
  InboxIcon,
  type LucideIcon,
} from "lucide-react"

import type { View } from "@/lib/api/types"

export const VIEW_META: Record<View, { label: string; icon: LucideIcon; hotkey: string }> = {
  inbox: { label: "Inbox", icon: InboxIcon, hotkey: "1" },
  snoozed: { label: "Snoozed", icon: AlarmClockIcon, hotkey: "2" },
  read: { label: "Read", icon: ArchiveIcon, hotkey: "3" },
  hidden: { label: "Hidden", icon: EyeOffIcon, hotkey: "4" },
}
