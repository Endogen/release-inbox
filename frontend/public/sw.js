/* Service worker: shows push notifications for new releases and opens them on click. */

const DEFAULT_URL = "/inbox"

self.addEventListener("install", () => self.skipWaiting())

self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()))

self.addEventListener("push", (event) => {
  const message = event.data ? event.data.json() : {}
  event.waitUntil(
    self.registration.showNotification(message.title ?? "New release", {
      body: message.body,
      tag: message.tag,
      icon: "/icons/icon-192.png",
      badge: "/icons/badge-96.png",
      data: { url: message.url ?? DEFAULT_URL },
    })
  )
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const url = new URL(event.notification.data?.url ?? DEFAULT_URL, self.location.origin)
  event.waitUntil(focusOrOpen(url))
})

async function focusOrOpen(url) {
  const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true })
  const existing = windows.find((client) => new URL(client.url).origin === url.origin)
  if (existing) {
    // The app routes in place, so the open tab keeps its state and only changes the selection.
    existing.postMessage({ type: "navigate", url: url.pathname + url.search })
    return existing.focus()
  }
  return self.clients.openWindow(url.href)
}
