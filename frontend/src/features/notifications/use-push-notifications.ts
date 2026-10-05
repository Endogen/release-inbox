import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { api } from "@/lib/api/client"
import type { PushConfig } from "@/lib/api/types"

import {
  getActiveSubscription,
  getPushSupport,
  subscribeToPush,
  unsubscribeFromPush,
} from "./push"

const pushKeys = {
  config: ["push", "config"] as const,
  subscription: ["push", "subscription"] as const,
}

export function usePushNotifications() {
  const queryClient = useQueryClient()
  const support = getPushSupport()

  const config = useQuery({
    queryKey: pushKeys.config,
    queryFn: ({ signal }) => api.get<PushConfig>("/push/config", { signal }),
    staleTime: Infinity,
  })

  const subscription = useQuery({
    queryKey: pushKeys.subscription,
    queryFn: async () => (await getActiveSubscription()) !== null,
    enabled: support === "supported",
  })

  const refreshSubscription = () =>
    queryClient.invalidateQueries({ queryKey: pushKeys.subscription })

  const enable = useMutation({
    mutationFn: () => {
      const publicKey = config.data?.public_key
      if (!publicKey) throw new Error("Push notifications are not configured on the server.")
      return subscribeToPush(publicKey)
    },
    onSettled: refreshSubscription,
  })

  const disable = useMutation({
    mutationFn: unsubscribeFromPush,
    onSettled: refreshSubscription,
  })

  const sendTest = useMutation({
    mutationFn: () => api.post("/push/test"),
  })

  return {
    support,
    serverEnabled: config.data?.enabled ?? false,
    isLoading: config.isPending || (support === "supported" && subscription.isPending),
    isSubscribed: subscription.data ?? false,
    enable,
    disable,
    sendTest,
  }
}
