// Web Push serveur — enveloppe web-push derrière les clés VAPID env.
// Sans configuration (VAPID_*), tout est no-op : l'app reste 100 % fonctionnelle.
import webpush from "web-push"

export const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY ?? ""
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY ?? ""
const VAPID_SUBJECT = process.env.VAPID_SUBJECT ?? "mailto:contact@sahtek.app"

export function pushConfigured(): boolean {
  return Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY)
}

let configured = false
function ensureConfigured() {
  if (!pushConfigured()) throw new Error("VAPID keys not configured")
  if (!configured) {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
    configured = true
  }
}

export type PushPayload = {
  title: string
  body: string
  url?: string
  tag?: string
}

/** Envoie une notification push. Retourne false si l'abonnement est mort (à supprimer). */
export async function sendPush(endpoint: string, p256dh: string, auth: string, payload: PushPayload): Promise<boolean> {
  ensureConfigured()
  try {
    await webpush.sendNotification({ endpoint, keys: { p256dh, auth } }, JSON.stringify(payload), {
      TTL: 24 * 3600,
      headers: { Urgency: "high" },
    })
    return true
  } catch (err) {
    const statusCode = (err as { statusCode?: number }).statusCode
    // 404/410 : l'abonnement n'existe plus (désinstallation, rotation des clés) → à purger
    if (statusCode === 404 || statusCode === 410) return false
    // Autres erreurs (timeout réseau, 5xx ponctuel) : on garde l'abonnement.
    console.warn("[push] send failed", statusCode, (err as Error).message)
    return true
  }
}
