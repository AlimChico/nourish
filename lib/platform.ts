/**
 * Détection de plateforme — source unique de vérité.
 *
 * Trois questions reviennent partout dans l'app (bannière d'install, guide,
 * notifications, téléchargement de l'APK) et chacune avait sa propre copie de
 * la même regex. Elles sont regroupées ici pour qu'un navigateur mal identifié
 * ne donne pas deux réponses différentes au même utilisateur.
 *
 * Toutes les fonctions sont sûres côté serveur (rendu SSR) : elles renvoient
 * `false` quand `window`/`navigator` n'existent pas, et doivent donc être
 * appelées depuis un `useEffect` (jamais pendant le rendu) pour éviter un
 * décalage d'hydratation.
 */

export type Platform = "ios" | "android" | "desktop"

/** Sommes-nous dans l'app native (APK Capacitor) et non dans le navigateur ? */
export function isNativeApp(): boolean {
  if (typeof window === "undefined") return false
  const bridge = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
  return typeof bridge?.isNativePlatform === "function" && bridge.isNativePlatform()
}

/** iPhone / iPad / iPod, y compris « Safari Mac » déguisé en tactile (iPadOS). */
export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false
  const ua = navigator.userAgent
  if (/iPad|iPhone|iPod/.test(ua)) return true
  return /Macintosh/.test(ua) && typeof document !== "undefined" && "ontouchend" in document
}

export function isAndroid(): boolean {
  if (typeof navigator === "undefined") return false
  return /Android/i.test(navigator.userAgent)
}

/** App déjà installée (PWA) : plein écran, sans barre de navigateur. */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true // iOS Safari
  )
}

export function detectPlatform(): Platform {
  if (isIOS()) return "ios"
  if (isAndroid()) return "android"
  return "desktop"
}

/**
 * Android « nu » = téléphone Android dans un navigateur (Chrome…), donc un
 * visiteur qui a un APK à installer. On exclut l'app native (elle est déjà
 * installée) et la PWA en plein écran (même raison).
 */
export function shouldOfferApk(): boolean {
  return isAndroid() && !isNativeApp() && !isStandalone()
}
