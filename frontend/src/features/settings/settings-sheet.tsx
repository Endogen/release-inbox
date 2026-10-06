import {
  AlertTriangleIcon,
  BellIcon,
  BellOffIcon,
  BellRingIcon,
  CheckIcon,
  EyeOffIcon,
  RefreshCwIcon,
  Trash2Icon,
} from "lucide-react"
import { toast } from "sonner"

import { RelativeTime } from "@/components/relative-time"
import { RepoAvatar } from "@/components/repo-avatar"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import { useDeleteHideRule, useHideRules } from "@/features/hide-rules/api"
import {
  useNotificationChannels,
  useSendTestNotification,
} from "@/features/notifications/api"
import { usePushNotifications } from "@/features/notifications/use-push-notifications"
import { usePreferences, useUpdatePreferences } from "@/features/preferences/api"
import { useMutedRepositories, useSetRepositoryNotifications } from "@/features/repositories/api"
import { useSyncNow, useSyncStatus } from "@/features/sync/api"
import type { NotificationChannel } from "@/lib/api/types"

interface SettingsSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SettingsSheet({ open, onOpenChange }: SettingsSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 sm:max-w-md">
        <SheetHeader className="border-b">
          <SheetTitle>Settings</SheetTitle>
          <SheetDescription>Notifications, hidden components and sync.</SheetDescription>
        </SheetHeader>
        <div className="flex flex-1 flex-col gap-8 overflow-y-auto p-4">
          <NotificationSettings />
          <MutedRepositorySettings />
          <Separator />
          <InboxSettings />
          <Separator />
          <HideRuleSettings />
          <Separator />
          <SyncSettings />
        </div>
      </SheetContent>
    </Sheet>
  )
}

const CHANNEL_LABELS: Record<NotificationChannel["name"], string> = {
  "web-push": "Browser push",
  ntfy: "ntfy",
  telegram: "Telegram",
}

function NotificationSettings() {
  const push = usePushNotifications()
  const channels = useNotificationChannels()
  const sendTest = useSendTestNotification()
  const preferences = usePreferences()
  const updatePreferences = useUpdatePreferences()
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
      onError: (error) => toast.error(error.message),
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
      onError: (error) => toast.error(error.message),
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
        {busy ? (
          <Spinner />
        ) : (
          <Switch
            id="push-notifications"
            checked={push.isSubscribed}
            onCheckedChange={toggle}
            disabled={unavailableReason !== null || push.isLoading}
          />
        )}
      </Field>
      <Field orientation="horizontal">
        <FieldContent>
          <FieldLabel htmlFor="notify-prereleases">Notify for pre-releases</FieldLabel>
          <FieldDescription>Betas, release candidates and nightly builds.</FieldDescription>
        </FieldContent>
        <Switch
          id="notify-prereleases"
          checked={preferences.data?.notify_prereleases ?? true}
          disabled={!preferences.data}
          onCheckedChange={(checked) =>
            updatePreferences.mutate({ notify_prereleases: checked })
          }
        />
      </Field>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">Server channels:</span>
        {serverChannels.map((channel) => (
          <Badge key={channel.name} variant={channel.configured ? "secondary" : "outline"}>
            {channel.configured ? <CheckIcon data-icon="inline-start" /> : null}
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

function InboxSettings() {
  const preferences = usePreferences()
  const updatePreferences = useUpdatePreferences()
  return (
    <FieldSet>
      <FieldLegend>Inbox</FieldLegend>
      <Field orientation="horizontal">
        <FieldContent>
          <FieldLabel htmlFor="show-prereleases">Show pre-releases</FieldLabel>
          <FieldDescription>
            When off, pre-releases are left out of every view except Hidden.
          </FieldDescription>
        </FieldContent>
        <Switch
          id="show-prereleases"
          checked={preferences.data?.show_prereleases ?? true}
          disabled={!preferences.data}
          onCheckedChange={(checked) => updatePreferences.mutate({ show_prereleases: checked })}
        />
      </Field>
    </FieldSet>
  )
}

function MutedRepositorySettings() {
  const muted = useMutedRepositories()
  const setNotifications = useSetRepositoryNotifications()

  return (
    <FieldSet>
      <FieldLegend variant="label">Muted repositories</FieldLegend>
      <FieldDescription>
        Every repository you watch notifies you, including ones you watch later. Mute a repository
        with the bell on one of its releases.
      </FieldDescription>
      {muted.isPending ? (
        <Skeleton className="h-14 w-full" />
      ) : muted.data && muted.data.length > 0 ? (
        <ItemGroup className="gap-2">
          {muted.data.map((repository) => (
            <Item key={repository.id} variant="outline" size="sm">
              <ItemMedia>
                <RepoAvatar repository={repository} className="size-8" />
              </ItemMedia>
              <ItemContent className="min-w-0">
                <ItemTitle className="w-full truncate">{repository.full_name}</ItemTitle>
                <ItemDescription className="flex items-center gap-1">
                  <BellOffIcon className="size-3" />
                  No push notifications
                </ItemDescription>
              </ItemContent>
              <ItemActions>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={
                    setNotifications.isPending &&
                    setNotifications.variables.repositoryId === repository.id
                  }
                  onClick={() =>
                    setNotifications.mutate(
                      { repositoryId: repository.id, enabled: true },
                      {
                        onSuccess: () =>
                          toast.success(`Notifications on for ${repository.full_name}`),
                      }
                    )
                  }
                >
                  <BellIcon data-icon="inline-start" />
                  Unmute
                </Button>
              </ItemActions>
            </Item>
          ))}
        </ItemGroup>
      ) : (
        <p className="text-sm text-muted-foreground">No repositories are muted.</p>
      )}
    </FieldSet>
  )
}

function HideRuleSettings() {
  const rules = useHideRules()
  const deleteRule = useDeleteHideRule()

  return (
    <FieldSet>
      <FieldLegend>Hidden components</FieldLegend>
      <FieldDescription>
        Releases matching these patterns are moved to the Hidden view.
      </FieldDescription>
      {rules.isPending ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : rules.data && rules.data.length > 0 ? (
        <ItemGroup className="gap-2">
          {rules.data.map((rule) => (
            <Item key={rule.id} variant="outline" size="sm">
              <ItemMedia>
                <RepoAvatar repository={rule.repository} className="size-8" />
              </ItemMedia>
              <ItemContent className="min-w-0">
                <ItemTitle className="w-full truncate font-mono">{rule.pattern}</ItemTitle>
                <ItemDescription className="truncate">
                  {rule.repository.full_name} · {rule.match_count}{" "}
                  {rule.match_count === 1 ? "release" : "releases"}
                </ItemDescription>
              </ItemContent>
              <ItemActions>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove rule ${rule.pattern}`}
                  disabled={deleteRule.isPending && deleteRule.variables === rule.id}
                  onClick={() =>
                    deleteRule.mutate(rule.id, {
                      onSuccess: () => toast.success(`Showing "${rule.pattern}" again`),
                    })
                  }
                >
                  <Trash2Icon />
                </Button>
              </ItemActions>
            </Item>
          ))}
        </ItemGroup>
      ) : (
        <Empty className="border border-dashed py-8">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <EyeOffIcon />
            </EmptyMedia>
            <EmptyTitle>No hidden components</EmptyTitle>
            <EmptyDescription>
              Choose Hide on a release to stop seeing a component of a repository.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </FieldSet>
  )
}

function SyncSettings() {
  const status = useSyncStatus()
  const syncNow = useSyncNow()
  const inProgress = syncNow.isPending || status.data?.in_progress

  return (
    <FieldSet>
      <FieldLegend>Sync</FieldLegend>
      <FieldDescription>
        GitHub is checked for new releases about once a minute.{" "}
        {status.data?.last_synced_at && (
          <>
            Last checked <RelativeTime date={status.data.last_synced_at} />.
          </>
        )}
      </FieldDescription>
      {status.data?.last_error && (
        <Alert variant="destructive">
          <AlertTriangleIcon />
          <AlertTitle>The last sync failed</AlertTitle>
          <AlertDescription>{status.data.last_error}</AlertDescription>
        </Alert>
      )}
      <Button
        variant="outline"
        size="sm"
        className="self-start"
        disabled={inProgress}
        onClick={() => syncNow.mutate()}
      >
        {inProgress ? (
          <Spinner data-icon="inline-start" />
        ) : (
          <RefreshCwIcon data-icon="inline-start" />
        )}
        Sync now
      </Button>
    </FieldSet>
  )
}
