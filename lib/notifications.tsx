"use client"

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react"
import { useFoodLog } from "@/lib/food-log"
import { appDateKey, shiftDateKey } from "@/lib/date-key"
import { useAccount, type MealReminderKey, type MealReminders } from "@/lib/account"
import { useHealth } from "@/lib/health"
import { DEFAULT_MEAL_REMINDERS } from "@/lib/account-schema"
import {
  notifyNow,
  notifyPermission,
  planReminders,
  requestNotifyPermission,
  type NotifyPermission,
  type ReminderPlanItem,
} from "@/lib/native-notify"

/**
 * Smart reminders.
 *
 * Deux moteurs selon la plateforme, un seul comportement visible :
 *  - app OUVERTE : les règles sont évaluées toutes les 5 minutes et la
 *    notification part immédiatement (Web Notification sur le site, canal natif
 *    dans l'APK) ;
 *  - app FERMÉE : impossible d'évaluer quoi que ce soit (un WebView ne tourne
 *    pas en arrière-plan), donc dans l'APK les rappels de repas sont PLANIFIÉS
 *    à l'avance auprès d'Android (voir `planReminders`).
 *
 * Règles (évaluées pendant que l'app est ouverte) :
 *  - Streak at risk: you logged yesterday and today but nothing yet this evening.
 *  - Goal not reached: after 20:00, calories still far below target.
 *  - Inactivity: no meal logged all day and it's past 14:00.
 *  - Rappels de repas (heure réglable) : matin / midi / soir — seulement si le
 *    repas est encore vide à l'heure choisie (voir `mealReminders`).
 */

type Rules = {
  streakAtRisk: boolean
  goalNotReached: boolean
  inactive: boolean
  lunchMissing: boolean
  dinnerMissing: boolean
}

type Store = {
  permission: NotifyPermission
  enable: () => Promise<void>
  lastNudge: string | null
  rules: Rules
  /** Rappel quotidien du budget calories (heure 12-22, désactivable). */
  digest: { enabled: boolean; hour: number }
  setDigest: (d: { enabled: boolean; hour: number }) => void
  /** Rappels « logger ce repas » : matin / midi / soir, heure réglable. */
  mealReminders: MealReminders
  setMealReminder: (key: MealReminderKey, hour: number | null) => void
}

const DIGEST_KEY = "nourish.digest.v1"
const DEFAULT_DIGEST = { enabled: true, hour: 20 }
const MEALS_KEY = "nourish.meal-reminders.v1"

/** Textes communs au rappel immédiat (app ouverte) et au rappel planifié. */
const MEAL_NUDGE: Record<MealReminderKey, { title: string; body: string }> = {
  breakfast: {
    title: "🌅 Breakfast not logged yet",
    body: "Lablabi, œufs, rayeb… snap your breakfast before the morning flies away.",
  },
  lunch: {
    title: "🥗 Lunchtime check-in",
    body: "You haven't logged lunch yet — snap a photo of your plate!",
  },
  dinner: {
    title: "🍽️ Dinner reminder",
    body: "Log your dinner before the day ends to protect your streak.",
  },
}

/** Emplacements réservés aux notifications planifiées (identifiant natif = jour × 10 + slot). */
const MEAL_SLOT: Record<MealReminderKey, number> = { breakfast: 1, lunch: 2, dinner: 3 }
const DIGEST_SLOT = 4

const DIGEST_NUDGE = {
  title: "🍽️ Ton récap du jour",
  body: "Ouvre Sahtek pour voir tes kcal restantes.",
}

function loadDigest(): { enabled: boolean; hour: number } {
  try {
    const raw = localStorage.getItem(DIGEST_KEY)
    if (!raw) return DEFAULT_DIGEST
    const p = JSON.parse(raw) as { enabled: boolean; hour: number }
    if (typeof p.enabled !== "boolean" || typeof p.hour !== "number") return DEFAULT_DIGEST
    return { enabled: p.enabled, hour: Math.min(Math.max(Math.round(p.hour), 12), 22) }
  } catch {
    return DEFAULT_DIGEST
  }
}

const Context = createContext<Store | null>(null)

export function SmartNotificationsProvider({ children }: { children: React.ReactNode }) {
  const { state, hydrated: logReady } = useFoodLog()
  const { state: account, targets, hydrated: accountReady, update: updateAccount } = useAccount()
  const { today: health, hydrated: healthReady } = useHealth()
  const [permission, setPermission] = useState<NotifyPermission>("unsupported")
  const [lastNudge, setLastNudge] = useState<string | null>(null)
  const [digest, setDigestState] = useState<Store["digest"]>(DEFAULT_DIGEST)
  const [mealReminders, setMealRemindersState] = useState<MealReminders>(DEFAULT_MEAL_REMINDERS)

  useEffect(() => {
    let cancelled = false
    // L'état réel vient du pont : « unsupported » ne doit être conclu qu'après
    // avoir interrogé la plateforme (navigateur OU canal natif de l'APK).
    void notifyPermission().then((p) => {
      if (!cancelled) setPermission(p)
    })
    setDigestState(loadDigest())
    try {
      const raw = localStorage.getItem(MEALS_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as MealReminders
        setMealRemindersState({
          breakfast: typeof parsed.breakfast === "number" ? parsed.breakfast : null,
          lunch: typeof parsed.lunch === "number" ? parsed.lunch : null,
          dinner: typeof parsed.dinner === "number" ? parsed.dinner : null,
        })
      }
    } catch {
      // storage unavailable — garder les valeurs par défaut
    }
    return () => {
      cancelled = true
    }
  }, [])

  /** Heure d'un rappel de repas (null = désactivé) + miroir dans le compte. */
  const setMealReminder = (key: MealReminderKey, hour: number | null) => {
    const next: MealReminders = { ...mealReminders, [key]: hour === null ? null : Math.min(23, Math.max(6, Math.round(hour))) }
    setMealRemindersState(next)
    try {
      localStorage.setItem(MEALS_KEY, JSON.stringify(next))
    } catch {
      // storage full
    }
    updateAccount({ mealReminders: next })
  }

  const setDigest = (d: Store["digest"]) => {
    setDigestState(d)
    try {
      localStorage.setItem(DIGEST_KEY, JSON.stringify(d))
    } catch {
      // storage full
    }
    // Miroir dans le compte → synchronisé vers le serveur pour le cron Web Push.
    updateAccount({ digestEnabled: d.enabled, digestHour: d.hour })
  }

  // Première visite : adopte l'heure du compte (qui a priorité sur les appareils
  // sans préférence locale) — le localStorage reste ensuite la préférence locale.
  useEffect(() => {
    if (!accountReady) return
    try {
      if (!localStorage.getItem(DIGEST_KEY)) {
        setDigestState({ enabled: account.digestEnabled, hour: account.digestHour })
      }
      // Rappels de repas : la préférence locale est prioritaire, mais sur un
      // appareil neuf on récupère celle du compte (qui a suivi l'utilisateur).
      if (!localStorage.getItem(MEALS_KEY) && account.mealReminders) {
        setMealRemindersState(account.mealReminders)
      }
    } catch {
      // storage unavailable
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountReady])

  const streak = useMemo(() => {
    // Same definition as Progress: consecutive logged days ending today.
    const days = [...(state.history ?? [])].reverse()
    let count = 0
    const hasToday = dayTotals(state.meals).calories > 0
    let cursor = hasToday ? 0 : 1
    const todayIso = state.date
    for (; cursor < 365; cursor++) {
      const iso = shiftDateKey(todayIso, -cursor)
      if (iso === todayIso) {
        if (hasToday) count++
        else continue
      } else {
        const hit = days.some((h) => h.date === iso && h.calories > 0)
        if (!hit) break
        count++
      }
    }
    return count
  }, [state])

  const rules = useMemo<Rules>(() => {
    const hour = new Date().getHours()
    const calories = dayTotals(state.meals).calories
    const loggedToday = state.meals && Object.values(state.meals).some((m) => m.length > 0)
    return {
      streakAtRisk: streak > 0 && !loggedToday && hour >= 17,
      goalNotReached: hour >= 20 && calories > 0 && calories < targets.calories * 0.7,
      inactive: !loggedToday && hour >= 14 && health.steps < 2000,
      // Les rappels de repas sont désormais pilotés par l'heure choisie par
      // l'utilisateur (`mealReminders`) — on n'ajoute donc plus de doublon
      // « déjeuner/dîner manquant » à heure fixe.
      lunchMissing: false,
      dinnerMissing: false,
    }
  }, [state, streak, targets.calories, health.steps])

  /**
   * Dernier état connu, accessible depuis l'intervalle d'évaluation. Les règles
   * et le journal changent à chaque repas : s'ils étaient dans les dépendances
   * de l'effet, l'intervalle de 5 minutes serait recréé à chaque changement et
   * ne se déclencherait donc JAMAIS pour un utilisateur actif — les rappels
   * seraient silencieusement morts. On passe par des refs.
   */
  const stateRef = useRef(state)
  stateRef.current = state
  const targetsRef = useRef(targets.calories)
  targetsRef.current = targets.calories
  const rulesRef = useRef(rules)
  rulesRef.current = rules
  const streakRef = useRef(streak)
  streakRef.current = streak

  // ---- Rappels planifiés dans l'OS (APK) -----------------------------------
  // Un WebView ne s'exécute pas app fermée : ces rappels doivent être confiés au
  // système à l'avance. On replanifie à chaque fois que quelque chose change
  // (réglage, repas du jour) et on compare une signature pour ne pas annuler /
  // replanifier trente alarmes pour rien.
  const [planTick, setPlanTick] = useState(0)
  const planned = useRef({ signature: "", at: 0 })

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") setPlanTick((t) => t + 1)
    }
    // Retour au premier plan ou retour du réseau : bon moment pour rallonger
    // l'horizon de planification.
    document.addEventListener("visibilitychange", refresh)
    window.addEventListener("online", refresh)
    return () => {
      document.removeEventListener("visibilitychange", refresh)
      window.removeEventListener("online", refresh)
    }
  }, [])

  useEffect(() => {
    if (!logReady || !accountReady || !healthReady || permission !== "granted") return
    const plan: ReminderPlanItem[] = []
    if (account.notifications) {
      for (const key of ["breakfast", "lunch", "dinner"] as const) {
        const hour = mealReminders[key]
        if (hour === null) continue
        plan.push({
          slot: MEAL_SLOT[key],
          hour,
          title: MEAL_NUDGE[key].title,
          body: MEAL_NUDGE[key].body,
          // Déjà loggé aujourd'hui → inutile de rappeler ce soir.
          doneToday: (state.meals[key]?.length ?? 0) > 0,
        })
      }
      if (digest.enabled) {
        plan.push({
          slot: DIGEST_SLOT,
          hour: digest.hour,
          title: DIGEST_NUDGE.title,
          body: DIGEST_NUDGE.body,
          // Le récap d'AUJOURD'HUI est calculé en direct (kcal restantes) par
          // l'évaluation ci-dessous : le planifier en aveugle ferait doublon.
          // Les jours suivants reçoivent la version générique.
          doneToday: true,
        })
      }
    }
    const signature = JSON.stringify(plan)
    // Rien n'a changé… mais un plan vieux d'une demi-journée doit être
    // rallongé pour tenir les 7 jours à venir.
    const stale = Date.now() - planned.current.at > 12 * 3600_000
    if (!stale && signature === planned.current.signature) return
    planned.current = { signature, at: Date.now() }
    void planReminders(plan)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    logReady,
    accountReady,
    healthReady,
    permission,
    account.notifications,
    mealReminders,
    digest.enabled,
    digest.hour,
    state.meals,
    planTick,
  ])

  // Evaluate every 5 minutes while the app is open.
  useEffect(() => {
    if (!logReady || !accountReady || !healthReady) return
    if (permission !== "granted") return

    const evaluate = () => {
      const hour = new Date().getHours()
      if (hour < 8 || hour >= 22) return // quiet hours 22:00-08:00
      const rules = rulesRef.current
      const meals = stateRef.current.meals
      const fired = (key: string) => {
        const stampKey = `nourish.nudge.${key}`
        try {
          const last = window.localStorage.getItem(stampKey)
          const today = appDateKey()
          if (last === today) return // once per day per rule
          window.localStorage.setItem(stampKey, today)
        } catch {
          return
        }
        notify(key)
      }

      if (rules.streakAtRisk) fired("streak")
      if (rules.goalNotReached) fired("goal")
      if (rules.inactive) fired("inactive")

      // Rappels de repas : uniquement si CE repas est encore vide à l'heure
      // choisie (sinon on notifierait pour rien) et une seule fois par jour.
      for (const key of ["breakfast", "lunch", "dinner"] as const) {
        const at = mealReminders[key]
        if (at === null) continue
        if (hour < at) continue
        if (meals[key].length > 0) continue
        fired(`meal-${key}`)
      }

      // Rappel QUOTIDIEN du budget calories (configurable dans Réglages).
      if (digest.enabled) {
        const h = new Date().getHours()
        if (h >= digest.hour && h < 23) {
          const stampKey = "nourish.nudge.digest"
          const today = appDateKey()
          const targetCal = targetsRef.current
          try {
            if (window.localStorage.getItem(stampKey) !== today) {
              window.localStorage.setItem(stampKey, today)
              const eatenCal = Math.round(dayTotals(meals).calories)
              const left = Math.max(0, targetCal - eatenCal)
              const over = eatenCal > targetCal
              void notifyNow(
                over ? `🧊 ${eatenCal - targetCal} kcal au-dessus du budget` : `🍽️ Il te reste ${left} kcal aujourd'hui`,
                over
                  ? `Journée à ${eatenCal} kcal pour ${targetCal} visées — une marche et hop, on repart demain !`
                  : `${eatenCal}/${targetCal} kcal consommées. ${left > 300 ? "De la place pour un dîner équilibré 🥗" : "Léger dîner conseillé 🍲"}`,
                "nourish-digest",
              )
              setLastNudge("digest")
            }
          } catch {
            // storage unavailable
          }
        }
      }
    }

    // PAS de notification à l'ouverture : on n'évalue qu'une fois l'app ouverte
    // depuis au moins 5 min (intervalle). Les rappels vraiment automatiques —
    // app fermée — viennent du Web Push serveur (cron /api/push/cron) sur le
    // web, et de la planification native dans l'APK.
    const id = window.setInterval(evaluate, 5 * 60_000)
    return () => window.clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permission, logReady, accountReady, healthReady, digest.enabled, digest.hour, mealReminders])

  const notify = (key: string) => {
    const messages: Record<string, { title: string; body: string }> = {
      streak: {
        title: `🔥 Don't lose your ${streakRef.current}-day streak!`,
        body: "Log a meal to keep your streak alive today.",
      },
      goal: {
        title: "🎯 You're still below your target",
        body: `Only ${Math.max(0, targetsRef.current - dayTotals(stateRef.current.meals).calories)} kcal logged. Add a snack or dinner.`,
      },
      inactive: {
        title: "⏰ Time to log your meals",
        body: "Nothing logged today. It takes 30 seconds with the scanner!",
      },
      "meal-breakfast": MEAL_NUDGE.breakfast,
      "meal-lunch": MEAL_NUDGE.lunch,
      "meal-dinner": MEAL_NUDGE.dinner,
    }
    const msg = messages[key]
    if (!msg) return
    void notifyNow(msg.title, msg.body, `nourish-${key}`)
    setLastNudge(key)
  }

  const enable = async () => {
    const res = await requestNotifyPermission()
    setPermission(res)
    if (res === "granted") {
      void notifyNow(
        "Sahtek notifications on 🔔",
        "We'll nudge you to keep your streak and reach your goal.",
        "nourish-welcome",
      )
    }
  }

  return (
    <Context.Provider
      value={{ permission, enable, lastNudge, rules, digest, setDigest, mealReminders, setMealReminder }}
    >
      {children}
    </Context.Provider>
  )
}

function dayTotals(meals: unknown): { calories: number } {
  // Local helper to avoid circular imports — mirrors lib/food-log dayTotals.
  const m = (meals ?? {}) as Record<string, { food: { calories: number }; quantity: number }[]>
  let calories = 0
  for (const list of Object.values(m)) {
    for (const e of list ?? []) calories += (e?.food?.calories ?? 0) * (e?.quantity ?? 0)
  }
  return { calories }
}

export function useSmartNotifications(): Store {
  const ctx = useContext(Context)
  if (!ctx) throw new Error("useSmartNotifications must be used inside <SmartNotificationsProvider>")
  return ctx
}
