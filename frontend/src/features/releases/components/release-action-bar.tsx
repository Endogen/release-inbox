import { AlarmClockOffIcon, BellOffIcon, CheckIcon, InboxIcon } from "lucide-react"

import { Hint } from "@/components/hint"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { useMediaQuery } from "@/hooks/use-media-query"
import { useNow } from "@/hooks/use-now"
import type { Release } from "@/lib/api/types"
import { HOTKEYS } from "@/lib/hotkeys"

import { useReleaseAssets } from "../api"
import { canSnooze, viewOf } from "../release-view"
import { ReleaseDownloads } from "./release-downloads"
import { ReleaseMoreMenu } from "./release-more-menu"
import { SnoozeMenu } from "./snooze-menu"

export interface ReleaseActions {
  onMarkRead: () => void
  onMarkUnread: () => void
  onHide: () => void
  onUnsubscribe: () => void
  onSnooze: (until: Date) => void
  onUnsnooze: () => void
  onCopyLink: () => void
}

/** Actions waiting for their undo window to pass. */
export interface PendingActions {
  markRead: boolean
  unsubscribe: boolean
}

interface ReleaseActionBarProps {
  release: Release
  actions: ReleaseActions
  pending: PendingActions
  snoozeMenuOpen: boolean
  onSnoozeMenuOpenChange: (open: boolean) => void
}

/** One row on every screen: the frequent actions, and a menu for the rest. */
export function ReleaseActionBar({
  release,
  actions,
  pending,
  snoozeMenuOpen,
  onSnoozeMenuOpenChange,
}: ReleaseActionBarProps) {
  const { repository } = release
  const now = useNow()
  const assets = useReleaseAssets(release.id).data ?? []
  // The row stays one line: on narrow phones, secondary actions show only their icon. The
  // download button, shown when there are files, takes about 3.75rem of it.
  const extra = assets.length > 0 ? 3.75 : 0
  const labels = {
    unsubscribe: useMediaQuery(`(min-width: ${25.5 + extra}rem)`),
    snooze: useMediaQuery(`(min-width: ${20.5 + extra}rem)`),
    downloads: useMediaQuery("(min-width: 22rem)"),
  }

  return (
    <div className="flex items-center gap-2">
      {release.read_at === null ? (
        <Hint hotkey={HOTKEYS.markRead} label="Mark this and older releases as read">
          <Button size="sm" onClick={actions.onMarkRead} aria-busy={pending.markRead}>
            {pending.markRead ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <CheckIcon data-icon="inline-start" />
            )}
            {pending.markRead ? "Marking as read…" : "Mark as read"}
          </Button>
        </Hint>
      ) : (
        <Hint hotkey={HOTKEYS.markUnread} label="Move back to the inbox">
          <Button size="sm" variant="secondary" onClick={actions.onMarkUnread}>
            <InboxIcon data-icon="inline-start" />
            Mark as unread
          </Button>
        </Hint>
      )}
      {canSnooze(release, now) &&
        (viewOf(release, now) === "snoozed" ? (
          <Hint label="Bring it back to the inbox now">
            <Button size="sm" variant="outline" onClick={actions.onUnsnooze}>
              <AlarmClockOffIcon data-icon="inline-start" />
              Unsnooze
            </Button>
          </Hint>
        ) : (
          <SnoozeMenu
            open={snoozeMenuOpen}
            onOpenChange={onSnoozeMenuOpenChange}
            onSnooze={actions.onSnooze}
            iconOnly={!labels.snooze}
            renderTrigger={(trigger) => (
              <Hint hotkey={HOTKEYS.snooze} label="Put it aside until later">
                {trigger}
              </Hint>
            )}
          />
        ))}
      {!repository.unsubscribed_at && (
        <Hint label="Stop watching this repository on GitHub">
          <Button
            size={labels.unsubscribe ? "sm" : "icon-sm"}
            variant="outline"
            onClick={actions.onUnsubscribe}
            aria-busy={pending.unsubscribe}
            aria-label={labels.unsubscribe ? undefined : "Unsubscribe"}
          >
            {pending.unsubscribe ? (
              <Spinner data-icon={labels.unsubscribe ? "inline-start" : undefined} />
            ) : (
              <BellOffIcon data-icon={labels.unsubscribe ? "inline-start" : undefined} />
            )}
            {labels.unsubscribe && (pending.unsubscribe ? "Unsubscribing…" : "Unsubscribe")}
          </Button>
        </Hint>
      )}
      {assets.length > 0 && (
        <ReleaseDownloads release={release} assets={assets} showCount={labels.downloads} />
      )}
      <div className="ml-auto">
        <ReleaseMoreMenu
          release={release}
          onCopyLink={actions.onCopyLink}
          onHide={actions.onHide}
        />
      </div>
    </div>
  )
}
