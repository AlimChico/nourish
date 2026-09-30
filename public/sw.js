/* Sahtek service worker — offline-first shell.
 *
 * Stratégie :
 *  - Coquille de l'app + assets statiques : cache-first, et surtout PRÉCACHÉS
 *    dès l'installation (voir precache()) → l'app démarre sans réseau même au
 *    tout premier lancement hors ligne, et se charge instantanément ensuite.
 *  - Pages : network-first, repli sur le cache puis sur la coquille (hors ligne).
 *  - API : jamais mise en cache — les données utilisateur doivent rester fraîches
 *    (et aucune donnée Supabase ne transite par ici).
 *
 * ⚠️ Toute modification du contenu de ce fichier doit s'accompagner d'un
 * incrément de VERSION : c'est le seul signal qui fait remplacer le service
 * worker (et donc rafraîchir les fichiers précachés) chez les utilisateurs.
 */
const VERSION = 18
const CACHE = `sahtek-v${VERSION}`

/** Fichiers toujours nécessaires au démarrage, quel que soit le build. */
const SHELL = [
  "/manifest.webmanifest",
  "/icon.svg",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-192.png",
  "/icons/icon-maskable-512.png",
  "/apple-touch-icon.png",
]

/**
 * Précache la coquille : les fichiers fixes, le HTML de la page d'accueil, puis
 * les chunks JS/CSS que CE build référence dans ce HTML.
 *
 * Pourquoi lire le HTML au lieu d'une liste figée : les noms des chunks Next.js
 * contiennent un hash de build. Une liste écrite à la main serait périmée au
 * déploiement suivant, et un `cache.addAll` refuse d'installer le service worker
 * dès qu'UNE seule URL manque — le hors-ligne cesserait de fonctionner
 * entièrement. Ici chaque ajout est indépendant : un fichier disparu ne casse
 * rien, et le précache suit toujours le build réellement déployé.
 */
async function precache(cache) {
  await Promise.allSettled(
    SHELL.map((url) => cache.add(new Request(url, { cache: "no-store" }))),
  )

  let html
  try {
    const res = await fetch(new Request("/", { cache: "no-store" }))
    if (!res.ok) return
    // Mis en cache tel quel : c'est le repli hors ligne des navigations.
    await cache.put("/", res.clone())
    html = await res.text()
  } catch {
    return
  }

  const urls = new Set()
  const re = /(?:src|href)="(\/_next\/static\/[^"]+)"/g
  let match
  while ((match = re.exec(html)) !== null) urls.add(match[1])
  await Promise.allSettled([...urls].map((url) => cache.add(url)))
}

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then(precache).then(() => self.skipWaiting()))
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
  // Cross-origin (AdSense, Vercel Analytics, polices tierces…) : on n'intercepte
  // JAMAIS. Un service worker qui met en cache des réponses tierces casse la
  // facturation AdSense, fausse les metrics Analytics et sert des scripts périmés.
  if (url.origin !== self.location.origin) return
  // Same-origin mais non-GET (POST/PUT…) ou API : jamais de cache — les données
  // utilisateur doivent toujours venir du réseau.
  if (event.request.method !== "GET" || url.pathname.startsWith("/api/")) return
  // Téléchargements de fichiers (l'APK Android, plusieurs Mo) : jamais de cache.
  // Un APK mis en cache serait servi indéfiniment à sa première version, et
  // stocker un binaire de cette taille dans le Cache API n'apporte rien.
  if (url.pathname.startsWith("/downloads/")) return
  // Requête « only-if-cached » hors same-origin : le navigateur la rejette.
  if (event.request.cache === "only-if-cached" && event.request.mode !== "same-origin") return

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
            // On ne mémorise qu'une réponse exploitable : mettre un 404 en cache
            // condamnerait le chunk pour toute la durée de vie du cache.
            if (res.ok) {
              const copy = res.clone()
              void caches.open(CACHE).then((c) => c.put(event.request, copy))
            }
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
        if (res.ok) {
          const copy = res.clone()
          void caches.open(CACHE).then((c) => c.put(event.request, copy))
        }
        return res
      })
      .catch(async () => {
        const hit = await caches.match(event.request)
        if (hit) return hit
        // Dernier recours : la coquille HTML — mais UNIQUEMENT pour une vraie
        // navigation. La servir pour autre chose (payload RSC de Next, prefetch)
        // renverrait du HTML là où le client attend du JSON : il échouerait sur
        // « Unexpected token '<' ». respondWith() doit TOUJOURS résoudre une
        // Response — d'où le Response.error() final, sinon il rejette avec
        // « Failed to convert value to 'Response' ».
        if (event.request.mode === "navigate") {
          const shell = await caches.match("/")
          if (shell) return shell
        }
        return Response.error()
      }),
  )
})
