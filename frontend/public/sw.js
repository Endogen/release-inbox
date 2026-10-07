/* Service worker: shows push notifications for new releases and opens them on click. */

const DEFAULT_URL = "/inbox"

self.addEventListener("install", () => self.skipWaiting())

self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()))

function readMessage(data) {
  if (!data) return {}
  try {
    return data.json()
  } catch {
    // Not JSON (e.g. a test push from browser dev tools): show the text as the body.
    return { body: data.text() }
  }
}

self.addEventListener("push", (event) => {
  const message = readMessage(event.data)
  event.waitUntil(
    Promise.all([
      self.registration.showNotification(message.title ?? "New release", {
        body: message.body,
        tag: message.tag,
        icon: "/icons/icon-192.png",
        badge: "/icons/badge-96.png",
        data: { url: message.url ?? DEFAULT_URL },
      }),
      updateAppBadge(message.unread),
    ])
  )
})

// The installed app's icon shows the number of inbox entries, also while the app is closed.
async function updateAppBadge(unread) {
  if (typeof unread !== "number" || !("setAppBadge" in self.navigator)) return
  try {
    await (unread > 0 ? self.navigator.setAppBadge(unread) : self.navigator.clearAppBadge())
  } catch {
    // Not allowed here (e.g. the app isn't installed); the badge is an extra.
  }
}

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

// The browser replaced the subscription (keys expired or were revoked): register the new one,
// so notifications keep arriving without visiting the settings again.
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(renewSubscription(event.oldSubscription, event.newSubscription))
})

async function renewSubscription(oldSubscription, newSubscription) {
  const options = oldSubscription?.options
  const subscription =
    newSubscription ?? (options ? await self.registration.pushManager.subscribe(options) : null)
  if (!subscription) return
  await sendSubscription("POST", subscription.toJSON())
  if (oldSubscription && oldSubscription.endpoint !== subscription.endpoint) {
    await sendSubscription("DELETE", { endpoint: oldSubscription.endpoint })
  }
}

function sendSubscription(method, body) {
  return fetch("/api/push/subscriptions", {
    method,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}
