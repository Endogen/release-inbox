import {
  AlarmClockIcon,
  ArchiveIcon,
  CheckCheckIcon,
  EyeOffIcon,
  InboxIcon,
  type LucideIcon,
} from "lucide-react"

import type { View } from "@/lib/api/types"

interface ViewMeta {
  label: string
  icon: LucideIcon
  hotkey: string
  /** Shown when the view has no releases. */
  empty: { icon: LucideIcon; title: string; description: string }
}

export const VIEW_META: Record<View, ViewMeta> = {
  inbox: {
    label: "Inbox",
    icon: InboxIcon,
    hotkey: "1",
    empty: {
      icon: CheckCheckIcon,
      title: "You're all caught up",
      description: "New releases from repositories you watch will show up here.",
    },
  },
  snoozed: {
    label: "Snoozed",
    icon: AlarmClockIcon,
    hotkey: "2",
    empty: {
      icon: AlarmClockIcon,
      title: "Nothing snoozed",
      description: "Snooze a release to put it aside; it comes back to the inbox when it's time.",
    },
  },
  read: {
    label: "Read",
    icon: ArchiveIcon,
    hotkey: "3",
    empty: {
      icon: ArchiveIcon,
      title: "No read releases yet",
      description: "Releases you mark as read are kept here for later.",
    },
  },
  hidden: {
    label: "Hidden",
    icon: EyeOffIcon,
    hotkey: "4",
    empty: {
      icon: EyeOffIcon,
      title: "Nothing hidden",
      description: "Hide releases of a component you don't care about to keep your inbox focused.",
    },
  },
}
