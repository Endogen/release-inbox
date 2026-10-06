import { useMutation, useQuery } from "@tanstack/react-query"

import { api } from "@/lib/api/client"
import type { NotificationChannel, NotificationTestResult } from "@/lib/api/types"

export function useNotificationChannels() {
  return useQuery({
    queryKey: ["notifications", "channels"],
    queryFn: ({ signal }) => api.get<NotificationChannel[]>("/notifications/channels", { signal }),
    staleTime: Infinity,
  })
}

/** Sends a test notification through every configured channel. */
export function useSendTestNotification() {
  return useMutation({
    mutationFn: () => api.post<NotificationTestResult>("/notifications/test"),
    meta: { errorMessage: "Couldn't send a test notification" },
  })
}
