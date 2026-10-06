import { api } from "@/lib/api/client"
import { decodeBase64Url } from "@/lib/base64-url"

const SERVICE_WORKER_URL = "/sw.js"
/** The pages the service worker controls: the whole app. */
const SCOPE = "/"

export type PushSupport = "supported" | "unsupported" | "insecure-context"

export function getPushSupport(): PushSupport {
  if (!window.isSecureContext) return "insecure-context"
  const supported =
    "serviceWorker" in navigator && "PushManager" in window && "Notification" in window
  return supported ? "supported" : "unsupported"
}

function registerServiceWorker(): Promise<ServiceWorkerRegistration> {
  return navigator.serviceWorker.register(SERVICE_WORKER_URL, { scope: SCOPE })
}

export async function getActiveSubscription(): Promise<PushSubscription | null> {
  if (getPushSupport() !== "supported") return null
  const registration = await navigator.serviceWorker.getRegistration(SCOPE)
  return (await registration?.pushManager.getSubscription()) ?? null
}

export async function subscribeToPush(publicKey: string): Promise<void> {
  const permission = await Notification.requestPermission()
  if (permission !== "granted") {
    throw new Error("Notifications are blocked. Allow them in your browser's site settings.")
  }

  const registration = await registerServiceWorker()
  await navigator.serviceWorker.ready
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: decodeBase64Url(publicKey),
    }))

  await api.post("/push/subscriptions", subscription.toJSON())
}

export async function unsubscribeFromPush(): Promise<void> {
  const subscription = await getActiveSubscription()
  if (!subscription) return
  await api.delete("/push/subscriptions", { endpoint: subscription.endpoint })
  await subscription.unsubscribe()
}
