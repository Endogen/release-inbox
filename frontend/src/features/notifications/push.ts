import { api } from "@/lib/api/client"

const SERVICE_WORKER_URL = "/sw.js"

export type PushSupport = "supported" | "unsupported" | "insecure-context"

export function getPushSupport(): PushSupport {
  if (!window.isSecureContext) return "insecure-context"
  const supported =
    "serviceWorker" in navigator && "PushManager" in window && "Notification" in window
  return supported ? "supported" : "unsupported"
}

export function registerServiceWorker(): Promise<ServiceWorkerRegistration> {
  return navigator.serviceWorker.register(SERVICE_WORKER_URL)
}

export async function getActiveSubscription(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.getRegistration(SERVICE_WORKER_URL)
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

function decodeBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const base64 = (value + "=".repeat((4 - (value.length % 4)) % 4))
    .replace(/-/g, "+")
    .replace(/_/g, "/")
  const binary = atob(base64)
  const bytes = new Uint8Array(new ArrayBuffer(binary.length))
  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}
