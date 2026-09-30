/**
 * Harnais : exécute public/sw.js dans un sandbox et vérifie
 *  1. QUAND le service worker intercepte une requête — il ne doit JAMAIS
 *     toucher au cross-origin (AdSense, Analytics) ni aux routes /api/ ;
 *  2. CE QU'il précache à l'installation — la coquille, les chunks réellement
 *     référencés par le HTML, et surtout la tolérance aux fichiers manquants.
 */
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const ORIGIN = 'https://nourish-roan.vercel.app'
const code = readFileSync('public/sw.js', 'utf8')

/** Page d'accueil simulée : deux chunks utiles, un chunk en 404, un script tiers. */
const HOME_HTML = `<!doctype html><html><head>
<link rel="stylesheet" href="/_next/static/css/app.css" />
<script src="/_next/static/chunks/app.js"></script>
<script src="/_next/static/chunks/deleted.js"></script>
<script src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"></script>
</head><body><div id="root"></div></body></html>`

/** Chemins que la fausse origine ne sert pas (404 côté serveur). */
const BROKEN = ['/icon.svg', '/_next/static/chunks/deleted.js']

const handlers = {}
const cached = new Set()
let skippedWaiting = false

const sandbox = {
  URL,
  Response,
  console,
  caches: {
    open: async () => ({
      add: async (request) => {
        const url = typeof request === 'string' ? new URL(request, ORIGIN).href : request.url
        if (BROKEN.some((p) => url.endsWith(p))) throw new TypeError('fetch failed')
        cached.add(url)
      },
      put: async (request, _res) => {
        const url = typeof request === 'string' ? new URL(request, ORIGIN).href : request.url
        cached.add(url)
      },
      addAll: async () => {},
    }),
    keys: async () => [],
    delete: async () => true,
    match: async (request) => {
      const url = typeof request === 'string' ? new URL(request, ORIGIN).href : request.url
      return cached.has(url) ? new Response('cached', { status: 200 }) : undefined
    },
  },
  fetch: async (request) => {
    const url = typeof request === 'string' ? request : request.url
    const path = url.startsWith('http') ? new URL(url).pathname : url
    if (BROKEN.includes(path)) throw new TypeError('fetch failed')
    // Réseau coupé : tout ce qui n'est pas déjà en cache échoue.
    if (path.includes('hors-ligne')) throw new TypeError('fetch failed')
    if (path === '/') return new Response(HOME_HTML, { status: 200 })
    return new Response('ok', { status: 200 })
  },
  self: {
    location: { origin: ORIGIN },
    addEventListener: (type, fn) => {
      handlers[type] = fn
    },
    skipWaiting: () => {
      skippedWaiting = true
    },
    clients: { claim: () => {}, matchAll: async () => [], openWindow: async () => {} },
    registration: { showNotification: async () => {} },
  },
}
sandbox.self.self = sandbox.self
sandbox.globalThis = sandbox
// Dans un service worker, `new Request("/chemin")` se résout sur l'origine du
// worker ; le Request de Node, lui, exige une URL absolue. On rétablit le
// comportement réel du navigateur.
sandbox.Request = function Request(input, init) {
  const resolved = typeof input === 'string' && input.startsWith('/') ? ORIGIN + input : input
  return new globalThis.Request(resolved, init)
}
vm.createContext(sandbox)
vm.runInContext(code, sandbox)

console.log('handlers enregistrés :', Object.keys(handlers).join(', '))
if (!handlers.install || !handlers.fetch || !handlers.activate) {
  console.log('ECHEC — handlers install/activate/fetch manquants')
  process.exit(1)
}

let failures = 0
const check = (ok, label) => {
  if (!ok) failures++
  console.log(`${ok ? 'OK  ' : 'ECHEC'} ${label}`)
}

// ---------------------------------------------------------------------------
// 1. Installation : précache de la coquille
// ---------------------------------------------------------------------------
const waits = []
handlers.install({ waitUntil: (p) => waits.push(p) })
await Promise.allSettled(waits)

check(skippedWaiting, "l'installation active bien la nouvelle version (skipWaiting)")
check(cached.has(`${ORIGIN}/`), "la page d'accueil est précachée (repli hors ligne)")
check(cached.has(`${ORIGIN}/manifest.webmanifest`), 'le manifeste est précaché')
check(cached.has(`${ORIGIN}/icons/icon-512.png`), 'les icônes sont précachées')
check(
  cached.has(`${ORIGIN}/_next/static/chunks/app.js`),
  'les chunks JS référencés par le HTML sont précachés',
)
check(
  cached.has(`${ORIGIN}/_next/static/css/app.css`),
  'les feuilles de style référencées par le HTML sont précachées',
)
check(
  !cached.has(`${ORIGIN}/_next/static/chunks/deleted.js`),
  'un chunk disparu (404) est ignoré au lieu de faire échouer le tout',
)
check(
  ![...cached].some((u) => u.includes('googlesyndication')),
  'un script tiers présent dans le HTML n\'est jamais précaché',
)
check(
  !cached.has(`${ORIGIN}/icon.svg`),
  "l'échec d'un fichier de la coquille n'empêche pas les autres d'être précachés",
)

// ---------------------------------------------------------------------------
// 2. Interception des requêtes
// ---------------------------------------------------------------------------
async function intercepts(url, method = 'GET') {
  let intercepted = false
  const event = {
    request: new globalThis.Request(url, { method }),
    respondWith: () => {
      intercepted = true
    },
    waitUntil: () => {},
    notification: { close: () => {}, data: {} },
  }
  handlers.fetch(event)
  return intercepted
}

const CASES = [
  // [url, méthode, doit-intercepter, raison]
  ['https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js', 'GET', false, 'AdSense (cross-origin)'],
  ['https://va.vercel-scripts.com/v1/script.debug.js', 'GET', false, 'Vercel Analytics (cross-origin)'],
  ['https://fonts.gstatic.com/s/manrope/x.woff2', 'GET', false, 'police tierce (cross-origin)'],
  [`${ORIGIN}/api/sync/entries`, 'GET', false, 'route API (jamais de cache)'],
  [`${ORIGIN}/api/scan-meal`, 'POST', false, 'route API en POST'],
  [`${ORIGIN}/api/leaderboard`, 'GET', false, 'classement'],
  [`${ORIGIN}/downloads/sahtek.apk`, 'GET', false, 'APK Android (jamais de cache)'],
  [`${ORIGIN}/_next/static/chunks/main.js`, 'GET', true, 'bundle Next (cache-first)'],
  [`${ORIGIN}/icons/icon-192.png`, 'GET', true, 'icône PWA'],
  [`${ORIGIN}/apple-touch-icon.png`, 'GET', true, 'icône iOS'],
  [`${ORIGIN}/`, 'GET', true, 'page (network-first)'],
  [`${ORIGIN}/leaderboard`, 'GET', true, 'page interne'],
]

for (const [url, method, expected, reason] of CASES) {
  const got = await intercepts(url, method)
  check(got === expected, `${method.padEnd(5)} ${expected ? 'intercepte' : 'ignore   '} — ${reason}`)
}

// ---------------------------------------------------------------------------
// 3. Hors ligne : une navigation inconnue ne doit jamais rejeter (respondWith
//    exige TOUJOURS une Response, sinon « Failed to convert value to 'Response' »)
// ---------------------------------------------------------------------------
async function offlineResponse(path, mode = 'cors') {
  const url = `${ORIGIN}${path}`
  // Une navigation ne peut pas être fabriquée avec `new Request(url, {mode:'navigate'})`
  // (mode réservé au navigateur) : on passe l'objet équivalent que le handler lit.
  const request =
    mode === 'navigate' ? { url, method: 'GET', cache: 'default', mode: 'navigate' } : new globalThis.Request(url)
  let promise
  handlers.fetch({
    request,
    respondWith: (p) => {
      promise = p
    },
    waitUntil: () => {},
  })
  return promise
}

// Une vraie navigation hors ligne reçoit la coquille précachée…
const shell = await offlineResponse('/hors-ligne-jamais-visitee', 'navigate')
check(
  shell instanceof Response && shell.status === 200,
  'hors ligne, une navigation reçoit la coquille mise en cache',
)

// … mais une requête de DONNÉES (payload RSC de Next, prefetch) ne doit jamais
// recevoir du HTML : le client échouerait sur « Unexpected token '<' ».
const payload = await offlineResponse('/hors-ligne-jamais-visitee?_rsc=abc')
check(
  payload instanceof Response && payload.type === 'error',
  "hors ligne, une requête non-navigation ne reçoit pas le HTML de la coquille",
)

console.log(failures === 0 ? '\nTous les cas passent.' : `\n${failures} cas en échec.`)
process.exit(failures === 0 ? 0 : 1)
