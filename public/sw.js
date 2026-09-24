/* Sahtek service worker — offline-first shell.
 * Strategy:
 *  - App shell & static assets: cache-first (works fully offline).
 *  - Pages: network-first with cache fallback (fresh when online, usable offline).
 *  - API: never cached (user data must stay fresh).
 */
const CACHE = "sahtek-v2"
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
