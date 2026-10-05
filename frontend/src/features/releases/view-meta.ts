import { ArchiveIcon, EyeOffIcon, InboxIcon, type LucideIcon } from "lucide-react"

import type { View } from "@/lib/api/types"

export const VIEW_META: Record<View, { label: string; icon: LucideIcon }> = {
  inbox: { label: "Inbox", icon: InboxIcon },
  read: { label: "Read", icon: ArchiveIcon },
  hidden: { label: "Hidden", icon: EyeOffIcon },
}
