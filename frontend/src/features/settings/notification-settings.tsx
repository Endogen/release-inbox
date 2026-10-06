import { BellRingIcon, CheckIcon } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import { useNotificationChannels, useSendTestNotification } from "@/features/notifications/api"
import { usePushNotifications } from "@/features/notifications/use-push-notifications"
import type { NotificationChannel } from "@/lib/api/types"

const CHANNEL_LABELS: Record<NotificationChannel["name"], string> = {
  "web-push": "Browser push",
  ntfy: "ntfy",
  telegram: "Telegram",
}

export function NotificationSettings() {
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
  const serverChannels = channels.data?.filter((channel) => channel.name !== "web-push") ?? []
  const anyConfigured = channels.data?.some((channel) => channel.configured) ?? false

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
        const entries = (Object.entries(delivered) as [NotificationChannel["name"], boolean][])
          // Browser push only reaches devices that turned it on; that isn't a failure here.
          .filter(([name, ok]) => ok || name !== "web-push" || push.isSubscribed)
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
      <Field orientation="horizontal" data-disabled={unavailableReason ? true : undefined}>
        <FieldContent>
          <FieldLabel htmlFor="push-notifications">Browser push on this device</FieldLabel>
          <FieldDescription>
            {unavailableReason ??
              "Get notified as soon as a new release is published, even when the app is closed."}
          </FieldDescription>
        </FieldContent>
        <Switch
          id="push-notifications"
          checked={push.isSubscribed}
          onCheckedChange={toggle}
          aria-busy={busy}
          disabled={unavailableReason !== null || push.isLoading || busy}
        />
      </Field>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">Server channels:</span>
        {serverChannels.map((channel) => (
          <Badge key={channel.name} variant={channel.configured ? "secondary" : "outline"}>
            {channel.configured && <CheckIcon data-icon="inline-start" />}
            {CHANNEL_LABELS[channel.name]}
            {!channel.configured && " · not set up"}
          </Badge>
        ))}
      </div>
      {anyConfigured && (
        <Button
          variant="outline"
          size="sm"
          className="self-start"
          disabled={sendTest.isPending}
          onClick={test}
        >
          {sendTest.isPending ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <BellRingIcon data-icon="inline-start" />
          )}
          Send test notification
        </Button>
      )}
    </FieldSet>
  )
}
