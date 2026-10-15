import { BellRingIcon, CheckIcon } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLegend,
  FieldSet,
  FieldTitle,
} from "@/components/ui/field"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { useNotificationChannels, useSendTestNotification } from "@/features/notifications/api"
import { usePushNotifications } from "@/features/notifications/use-push-notifications"
import { usePreferences, useUpdatePreferences } from "@/features/preferences/api"
import type { NotificationChannel, NotifyAbout } from "@/lib/api/types"
import { isDesktop } from "@/lib/desktop"

import { ChoiceField, SwitchField } from "./setting-fields"

const CHANNEL_LABELS: Record<NotificationChannel["name"], string> = {
  "web-push": "Browser push",
  ntfy: "ntfy",
  telegram: "Telegram",
  desktop: "Desktop app",
}

/** Channels shown with the device's own switch or note rather than as a server badge. */
const DEVICE_CHANNELS: ReadonlySet<NotificationChannel["name"]> = new Set(["web-push", "desktop"])

const NOTIFY_ABOUT: ReadonlyArray<{ value: NotifyAbout; label: string }> = [
  { value: "all", label: "All" },
  { value: "breaking", label: "Breaking only" },
]

export function NotificationSettings() {
  const preferences = usePreferences()
  const update = useUpdatePreferences()
  const push = usePushNotifications()
  const channels = useNotificationChannels()
  const sendTest = useSendTestNotification()
  const busy = push.enable.isPending || push.disable.isPending
  const unavailableReason =
    push.support === "insecure-context"
      ? "Browser push needs a secure (HTTPS) connection."
      : push.support === "unsupported"
        ? "This browser doesn't support push notifications. On iOS, add the app to your home screen first."
        : !push.serverEnabled && !push.isLoading
          ? "Browser push isn't configured on the server. Set the VAPID keys to enable it."
          : null
  const desktop = isDesktop()
  const serverChannels =
    channels.data?.filter((channel) => !DEVICE_CHANNELS.has(channel.name)) ?? []
  // Whether a channel's failure to deliver concerns this device: browser push only reaches
  // devices that turned it on, the desktop channel only running desktop apps.
  const reachesHere: Record<NotificationChannel["name"], boolean> = {
    "web-push": push.isSubscribed,
    desktop,
    ntfy: true,
    telegram: true,
  }
  // The desktop channel is always there, but only reaches anyone while a desktop app runs.
  const anyConfigured =
    channels.data?.some(
      (channel) => channel.configured && (channel.name !== "desktop" || desktop)
    ) ?? false

  function toggle(enabled: boolean) {
    const mutation = enabled ? push.enable : push.disable
    mutation.mutate(undefined, {
      onSuccess: () =>
        toast.success(enabled ? "Browser push turned on" : "Browser push turned off"),
    })
  }

  function test() {
    sendTest.mutate(undefined, {
      onSuccess: ({ delivered }) => {
        const entries = (
          Object.entries(delivered) as [NotificationChannel["name"], boolean][]
        ).filter(([name, ok]) => ok || reachesHere[name])
        const sent = entries.filter(([, ok]) => ok).map(([name]) => CHANNEL_LABELS[name])
        const failed = entries.filter(([, ok]) => !ok).map(([name]) => CHANNEL_LABELS[name])
        if (failed.length > 0) toast.error(`Couldn't deliver via ${failed.join(", ")}`)
        else if (sent.length > 0) toast.success(`Test notification sent via ${sent.join(", ")}`)
        else toast.info("Turn on browser push or set up ntfy or Telegram to receive notifications.")
      },
    })
  }

  return (
    <FieldSet>
      <FieldLegend>Notifications</FieldLegend>
      {desktop ? (
        <Field>
          <FieldContent>
            <FieldTitle>Desktop notifications</FieldTitle>
            <FieldDescription>
              Shown while the app runs, also when it's closed to the tray.
            </FieldDescription>
          </FieldContent>
        </Field>
      ) : (
        <SwitchField
          label="Browser push on this device"
          description={unavailableReason ?? "Even when the app is closed."}
          checked={push.isSubscribed}
          onCheckedChange={toggle}
          busy={busy}
          disabled={unavailableReason !== null || push.isLoading || busy}
        />
      )}
      {preferences.data ? (
        <ChoiceField
          label="Notify about"
          description="New releases, on every channel."
          value={preferences.data.notify_about}
          options={NOTIFY_ABOUT}
          onValueChange={(notifyAbout) => update.mutate({ notify_about: notifyAbout })}
        />
      ) : (
        <Skeleton className="h-10 w-full" />
      )}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {serverChannels.map((channel) => (
          <Badge key={channel.name} variant={channel.configured ? "secondary" : "outline"}>
            {channel.configured && <CheckIcon data-icon="inline-start" />}
            {CHANNEL_LABELS[channel.name]}
            {!channel.configured && " · not set up"}
          </Badge>
        ))}
        {anyConfigured && (
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto"
            disabled={sendTest.isPending}
            onClick={test}
          >
            {sendTest.isPending ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <BellRingIcon data-icon="inline-start" />
            )}
            Send test
          </Button>
        )}
      </div>
    </FieldSet>
  )
}
