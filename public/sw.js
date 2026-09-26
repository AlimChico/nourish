/* Sahtek service worker — offline-first shell.
 * Strategy:
 *  - App shell & static assets: cache-first (works fully offline).
 *  - Pages: network-first with cache fallback (fresh when online, usable offline).
 *  - API: never cached (user data must stay fresh).
 */
const CACHE = "sahtek-v9"
const SHELL = [
  "/",
  "/icon.svg",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-192.png",
  "/icons/icon-maskable-512.png",
  "/apple-touch-icon.png",
]

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()),
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

// ---- Web Push ----
self.addEventListener("push", (event) => {
  let data = { title: "Sahtek", body: "", url: "/" }
  try {
    if (event.data) data = { ...data, ...event.data.json() }
  } catch {
    if (event.data) data.body = event.data.text()
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-maskable-192.png",
      tag: data.tag || "sahtek",
      data: { url: data.url || "/" },
    }),
  )
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || "/"
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          client.navigate(url).catch(() => {})
          return client.focus()
        }
      }
      return self.clients.openWindow(url)
    }),
  )
})

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url)
  if (event.request.method !== "GET" || url.pathname.startsWith("/api/")) return

  // Static assets: cache-first.
  if (
    url.pathname.startsWith("/_next/static") ||
    url.pathname === "/icon.svg" ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/apple-touch-icon.png"
  ) {
    event.respondWith(
      caches.match(event.request).then(
        (hit) =>
          hit ??
          fetch(event.request).then((res) => {
            const copy = res.clone()
            void caches.open(CACHE).then((c) => c.put(event.request, copy))
            return res
          }),
      ),
    )
    return
  }

  // Pages: network-first, fall back to cache (offline).
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        const copy = res.clone()
        void caches.open(CACHE).then((c) => c.put(event.request, copy))
        return res
      })
      .catch(() => caches.match(event.request).then((hit) => hit ?? caches.match("/"))),
  )
})
