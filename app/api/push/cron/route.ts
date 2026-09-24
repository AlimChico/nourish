import { db } from "@/lib/server/db"
import { pushConfigured, sendPush } from "@/lib/server/push"
import { calcNutrition } from "@/lib/nutrition-data"
import type { AccountState } from "@/lib/account-schema"
import type { MealKey } from "@/lib/food-log"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

/**
 * Cron horaire (Vercel Cron) : envoie le digest quotidien « Il te reste X kcal »
 * à l'heure choisie par chaque utilisateur (fuseau Tunis, défaut 20h).
 * Sécurité : CRON_SECRET attendu en Authorization Bearer (Vercel l'envoie
 * automatiquement quand la variable est définie).
 *
 * La préférence heure + l'activation vivent dans account.notifications /
 * account.digestHour (mêmes réglages que le rappel local).
 */

const TZ = "Africa/Tunis"
const MAX_PER_RUN = 2000
/**
 * PUSH_CRON_MODE=hourly → l'heure exacte choisie par chaque utilisateur est honorée
 * (nécessite un cron horaire : Vercel Pro, ou un ping externe type cron-job.org).
 * Par défaut (mode journalier, plan Hobby Vercel = 1 cron/jour max) : l'envoi part
 * une fois par jour à l'heure du cron (20h Tunis), sans filtrage par utilisateur.
 */
const HOURLY = process.env.PUSH_CRON_MODE === "hourly"

function dayKeyTunis(d = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d)
}

function hourTunis(d = new Date()): number {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", hour12: false }).format(d))
}

type AccountBlob = AccountState & { digestEnabled?: boolean; digestHour?: number }

type DayData = {
  meals?: Partial<Record<MealKey, { food: { calories: number }; quantity: number }[]>>
}

function eatenCalories(day: DayData | null): number {
  if (!day?.meals) return 0
  let total = 0
  for (const entries of Object.values(day.meals)) {
    for (const e of entries ?? []) {
      total += e.food.calories * e.quantity
    }
  }
  return Math.round(total)
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  const authHeader = request.headers.get("authorization") ?? ""
  if (secret && authHeader !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!pushConfigured()) {
    return Response.json({ ok: true, skipped: "push-not-configured" }, { status: 200 })
  }

  const subs = await db.listPushSubscriptions()
  if (subs.length === 0) return Response.json({ ok: true, sent: 0 })
  // Une ligne par utilisateur (le premier endpoint trouvé suffit).
  const seen = new Set<string>()
  const perUser = subs.filter((s) => (seen.has(s.userId) ? false : (seen.add(s.userId), true)))
  if (perUser.length > MAX_PER_RUN) perUser.length = MAX_PER_RUN

  const nowHour = hourTunis()
  const today = dayKeyTunis()
  let sent = 0
  let failed = 0
  let skippedAlready = 0
  let skippedHour = 0
  let skippedDisabled = 0
  const deadEndpoints: { userId: string; endpoint: string }[] = []

  for (const sub of perUser) {
    const account = (await db.getJson("account", sub.userId)) as AccountBlob | null
    if (!account) {
      skippedDisabled += 1
      continue
    }
    // Le toggle serveur : digestEnabled (défaut true si notifications actives).
    const enabled = account.digestEnabled !== false && account.notifications !== false
    if (!enabled) {
      skippedDisabled += 1
      continue
    }
    const targetHour = clampHour(account.digestHour ?? 20)
    if (sub.lastSentDate === today) {
      skippedAlready += 1
      continue
    }
    if (HOURLY && nowHour !== targetHour) {
      skippedHour += 1
      continue
    }
    // Mode journalier : dédup suffit (un envoi/jour max, à l'heure du cron).

    const day = (await db.getDay(sub.userId, today)) as DayData | null
    const acc = calcNutrition({
      gender: account.gender,
      age: account.age,
      height: account.height,
      weight: account.weight,
      activity: account.activity,
      goal: account.goal,
    })
    const target = account.calorieOverride && account.calorieOverride >= 800 ? account.calorieOverride : acc.calories
    const remaining = Math.max(0, Math.round(target - eatenCalories(day)))

    const ok = await sendPush(sub.endpoint, sub.p256dh, sub.auth, {
      title: remaining > 0 ? "Il te reste " + remaining + " kcal 🍽️" : "Objectif du jour atteint ! 🎉",
      body:
        remaining > 0
          ? "Prévois ton dîner — " + remaining + " kcal restantes sur " + target + ". Ouvre Sahtek pour loguer."
          : "Bravo, tu as tenu ton budget calories aujourd'hui. On continue demain 💚",
      url: "/",
      tag: "daily-digest",
    })
    if (ok) {
      await db.markPushSent(sub.endpoint, today)
      sent += 1
    } else {
      deadEndpoints.push({ userId: sub.userId, endpoint: sub.endpoint })
      failed += 1
    }
  }

  // Purge des abonnements morts (410/404) — tous les endpoints de l'utilisateur,
  // pas seulement le premier par utilisateur.
  for (const dead of deadEndpoints) {
    await db.deletePushSubscription(dead.endpoint)
  }

  return Response.json({ ok: true, hour: nowHour, sent, failed, skippedAlready, skippedHour, skippedDisabled, purged: deadEndpoints.length })
}

function clampHour(h: number): number {
  const n = Math.round(Number(h))
  if (!isFinite(n)) return 20
  return Math.min(22, Math.max(12, n))
}
