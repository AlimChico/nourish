"use client"

/**
 * Notifications — un seul point d'entrée pour le site ET l'APK.
 *
 * Pourquoi ce pont existe : dans le WebView Android, l'API `Notification` n'est
 * pas exposée (elle appartient à Chrome, pas au composant WebView). `new
 * Notification()` y est donc absent, `Notification.requestPermission()` aussi.
 * Sans ce pont, TOUS les rappels de Sahtek sont muets dans l'APK — et l'écran
 * Réglages les masque, puisqu'il les croit « non supportés ».
 *
 * Le plugin natif apporte en plus ce que le Web ne sait pas faire ici :
 * planifier une notification À L'AVANCE. C'est indispensable, car un WebView ne
 * s'exécute pas quand l'app est fermée : le `setInterval` d'évaluation des
 * règles s'arrête avec elle. Les rappels de repas sont donc confiés au système
 * (Android les déclenche lui-même, app fermée ou téléphone en veille).
 *
 * Choix assumé : `isExactNotification: false` partout. Avec la valeur par
 * défaut (`true`), Android 12+ ouvre l'écran système « Alarmes et rappels »
 * pendant la planification pour réclamer une permission que le Play Store
 * réserve aux réveils et aux agendas. Un rappel de repas n'a pas besoin d'une
 * précision à la seconde : une alarme inexacte suffit, et elle ne demande rien
 * à l'utilisateur.
 */

export type NotifyPermission = "granted" | "denied" | "default" | "unsupported"

const CHANNEL_ID = "sahtek-reminders"

/**
 * Nombre de jours planifiés d'avance. Chaque ouverture de l'app (et chaque
 * changement de réglage ou de repas) remet le plan à jour ; cet horizon couvre
 * largement une semaine d'inutilisation sans jamais laisser de trou.
 */
export const SCHEDULE_DAYS = 7

/** Canal Android : l'utilisateur peut couper les rappels de Sahtek sans couper le reste. */
const CHANNEL = {
  id: CHANNEL_ID,
  name: "Rappels Sahtek",
  description: "Repas à logger et budget de calories du jour.",
  importance: 3,
  visibility: 1,
  vibration: true,
} as const

type LocalNotificationsPlugin = typeof import("@capacitor/local-notifications")["LocalNotifications"]

/** Sommes-nous dans l'app native (APK/Capacitor) et non dans le navigateur ? */
export function isNativeApp(): boolean {
  if (typeof window === "undefined") return false
  const bridge = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
  return typeof bridge?.isNativePlatform === "function" && bridge.isNativePlatform()
}

/**
 * Chargé dynamiquement : le plugin n'est téléchargé que dans l'APK, jamais par
 * les visiteurs du site (aucun octet ajouté au bundle web).
 */
async function plugin(): Promise<LocalNotificationsPlugin | null> {
  if (!isNativeApp()) return null
  try {
    const mod = await import("@capacitor/local-notifications")
    return mod.LocalNotifications
  } catch {
    return null
  }
}

/** « prompt-with-rationale » (Android) et « prompt » valent tous deux « pas encore demandé ». */
function normalize(display: string): NotifyPermission {
  if (display === "granted") return "granted"
  if (display === "denied") return "denied"
  return "default"
}

function webPermission(): NotifyPermission {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported"
  return (Notification.permission as NotifyPermission) ?? "default"
}

/** État courant, sans jamais ouvrir de boîte de dialogue. */
export async function notifyPermission(): Promise<NotifyPermission> {
  if (!isNativeApp()) return webPermission()
  const LN = await plugin()
  if (!LN) return "unsupported"
  try {
    return normalize((await LN.checkPermissions()).display)
  } catch {
    return "default"
  }
}

/** Demande l'autorisation (dialogue système Android 13+, ou navigateur). */
export async function requestNotifyPermission(): Promise<NotifyPermission> {
  if (!isNativeApp()) {
    if (typeof window === "undefined" || !("Notification" in window)) return "unsupported"
    try {
      return (await Notification.requestPermission()) as NotifyPermission
    } catch {
      return "denied"
    }
  }
  const LN = await plugin()
  if (!LN) return "unsupported"
  try {
    return normalize((await LN.requestPermissions()).display)
  } catch {
    return "unsupported"
  }
}

let channelReady = false

async function ensureChannel(LN: LocalNotificationsPlugin): Promise<void> {
  if (channelReady) return
  // Recréer un canal existant ne fait que mettre à jour ses métadonnées.
  await LN.createChannel({ ...CHANNEL }).catch(() => {})
  channelReady = true
}

/** Identifiants dédiés aux notifications immédiates (les rappels planifiés utilisent 0-99). */
let immediateId = 900_000

/**
 * Affiche une notification TOUT DE SUITE (rappel déclenché par une règle évaluée
 * pendant que l'app est ouverte : série en danger, objectif non atteint…).
 */
export async function notifyNow(title: string, body: string, tag: string): Promise<void> {
  if (!isNativeApp()) {
    if (typeof window === "undefined" || !("Notification" in window)) return
    if (Notification.permission !== "granted") return
    try {
      new Notification(title, { body, tag })
    } catch {
      // notification refusée — sans conséquence
    }
    return
  }

  const LN = await plugin()
  if (!LN) return
  try {
    if (normalize((await LN.checkPermissions()).display) !== "granted") return
    await ensureChannel(LN)
    await LN.schedule({
      notifications: [
        {
          id: immediateId++,
          title,
          body,
          channelId: CHANNEL_ID,
          // Priorité haute : sans ça, une notification émise pendant que l'app
          // est au premier plan peut ne pas s'afficher du tout.
          foreground: true,
          // Alarme inexacte : on ne réclame jamais la permission d'alarme exacte
          // (l'écran système ne doit pas surgir). Sans effet sur l'immédiateté :
          // Android déclenche immédiatement une alarme dont l'heure est passée,
          // et le mode Doze ne s'applique pas quand l'app est au premier plan.
          isExactNotification: false,
          schedule: { at: new Date(Date.now() + 500) },
        },
      ],
    })
  } catch {
    // planification refusée — l'app continue de fonctionner
  }
}

export type ReminderPlanItem = {
  /** Emplacement stable (1-9) : combiné au jour, il forme l'identifiant natif. */
  slot: number
  hour: number
  title: string
  body: string
  /** Rien à rappeler aujourd'hui : ce repas est déjà loggé (ou déjà notifié). */
  doneToday?: boolean
}

async function cancelPlanned(LN: LocalNotificationsPlugin): Promise<void> {
  const pending = await LN.getPending()
  const ids = pending.notifications.map((n) => ({ id: n.id }))
  if (ids.length) await LN.cancel({ notifications: ids })
}

/**
 * Remplace tout le plan de rappels par celui fourni.
 *
 * On planifie des occurrences UNIQUES (et non un rappel quotidien répété) :
 * c'est le seul moyen de sauter le rappel d'aujourd'hui quand l'utilisateur a
 * déjà loggé son repas — un rappel « tous les jours à 9 h » ne peut pas être
 * annulé pour une seule journée. Tout est annulé puis replanifié, ce qui rend
 * la fonction idempotente : l'appeler dix fois donne le même résultat.
 */
export async function planReminders(plan: ReminderPlanItem[]): Promise<void> {
  if (!isNativeApp()) return
  const LN = await plugin()
  if (!LN) return
  try {
    await cancelPlanned(LN)
    // Pas la permission : rien à planifier, mais on a nettoyé l'existant.
    if (normalize((await LN.checkPermissions()).display) !== "granted") return
    if (plan.length === 0) return
    await ensureChannel(LN)

    const now = Date.now()
    const notifications: import("@capacitor/local-notifications").LocalNotificationSchema[] = []
    for (let day = 0; day < SCHEDULE_DAYS; day++) {
      for (const item of plan) {
        if (day === 0 && item.doneToday) continue
        const at = new Date()
        at.setDate(at.getDate() + day)
        // Heure murale locale : c'est bien l'heure de l'utilisateur qui compte,
        // pas celle du fuseau de référence de l'app (Africa/Tunis).
        at.setHours(item.hour, 0, 0, 0)
        // Marge de 2 min : Android ignore une alarme planifiée dans le passé.
        if (at.getTime() < now + 120_000) continue
        notifications.push({
          id: day * 10 + item.slot,
          title: item.title,
          body: item.body,
          channelId: CHANNEL_ID,
          isExactNotification: false,
          schedule: { at, allowWhileIdle: true },
        })
      }
    }
    if (notifications.length) await LN.schedule({ notifications })
  } catch {
    // planification impossible — les rappels en-app continuent de fonctionner
  }
}

/** Coupe tous les rappels (utilisateur qui désactive les notifications). */
export async function clearReminders(): Promise<void> {
  if (!isNativeApp()) return
  const LN = await plugin()
  if (!LN) return
  try {
    await cancelPlanned(LN)
  } catch {
    // rien à faire
  }
}
