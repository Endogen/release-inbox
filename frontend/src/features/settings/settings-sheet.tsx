import {
  AlertTriangleIcon,
  BellRingIcon,
  EyeOffIcon,
  RefreshCwIcon,
  Trash2Icon,
} from "lucide-react"
import { toast } from "sonner"

import { RelativeTime } from "@/components/relative-time"
import { RepoAvatar } from "@/components/repo-avatar"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
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
import { usePushNotifications } from "@/features/notifications/use-push-notifications"
import { useSyncNow, useSyncStatus } from "@/features/sync/api"

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
          <Separator />
          <HideRuleSettings />
          <Separator />
          <SyncSettings />
        </div>
      </SheetContent>
    </Sheet>
  )
}

function NotificationSettings() {
  const push = usePushNotifications()
  const busy = push.enable.isPending || push.disable.isPending
  const unavailableReason =
    push.support === "insecure-context"
      ? "Notifications need a secure (HTTPS) connection."
      : push.support === "unsupported"
        ? "This browser doesn't support push notifications. On iOS, add the app to your home screen first."
        : !push.serverEnabled && !push.isLoading
          ? "Push isn't configured on the server. Set the VAPID keys to enable it."
          : null

  function toggle(enabled: boolean) {
    const mutation = enabled ? push.enable : push.disable
    mutation.mutate(undefined, {
      onSuccess: () =>
        toast.success(enabled ? "Notifications turned on" : "Notifications turned off"),
      onError: (error) => toast.error(error.message),
    })
  }

  return (
    <FieldSet>
      <FieldLegend>Notifications</FieldLegend>
      <Field orientation="horizontal" data-disabled={unavailableReason ? true : undefined}>
        <FieldContent>
          <FieldLabel htmlFor="push-notifications">Push notifications</FieldLabel>
          <FieldDescription>
            {unavailableReason ??
              "Get notified on this device as soon as a new release is published, even when the app is closed."}
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
      {push.isSubscribed && (
        <Button
          variant="outline"
          size="sm"
          className="self-start"
          disabled={push.sendTest.isPending}
          onClick={() =>
            push.sendTest.mutate(undefined, {
              onError: (error) => toast.error(error.message),
            })
          }
        >
          {push.sendTest.isPending ? (
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
