"use client"

import { createContext, useContext, useEffect, useMemo, useState } from "react"
import { useFoodLog } from "@/lib/food-log"
import { useAccount } from "@/lib/account"
import { useHealth } from "@/lib/health"

/**
 * Smart reminders via the Web Notifications API.
 * Rules (evaluated while the app is open):
 *  - Streak at risk: you logged yesterday and today but nothing yet this evening.
 *  - Goal not reached: after 20:00, calories still far below target.
 *  - Inactivity: no meal logged all day and it's past 14:00.
 */

type Rules = {
  streakAtRisk: boolean
  goalNotReached: boolean
  inactive: boolean
}

type Store = {
  permission: NotificationPermission | "unsupported"
  enable: () => Promise<void>
  lastNudge: string | null
  rules: Rules
}

const Context = createContext<Store | null>(null)

export function SmartNotificationsProvider({ children }: { children: React.ReactNode }) {
  const { state, hydrated: logReady } = useFoodLog()
  const { state: account, targets, hydrated: accountReady } = useAccount()
  const { today: health, hydrated: healthReady } = useHealth()
  const [permission, setPermission] = useState<Store["permission"]>("unsupported")
  const [lastNudge, setLastNudge] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setPermission(Notification.permission)
    }
  }, [])

  const streak = useMemo(() => {
    // Same definition as Progress: consecutive logged days ending today.
    const days = [...(state.history ?? [])].reverse()
    let count = 0
    const hasToday = dayTotals(state.meals).calories > 0
    let cursor = hasToday ? 0 : 1
    const todayIso = state.date
    for (; cursor < 365; cursor++) {
      const d = new Date(`${todayIso}T12:00:00`)
      d.setDate(d.getDate() - cursor)
      const iso = d.toISOString().slice(0, 10)
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
    }
  }, [state, streak, targets.calories, health.steps])

  // Evaluate every 5 minutes while the app is open.
  useEffect(() => {
    if (!logReady || !accountReady || !healthReady) return
    if (permission !== "granted") return

    const evaluate = () => {
      const hour = new Date().getHours()
      if (hour < 8 || hour >= 22) return // quiet hours 22:00-08:00
      const fired = (key: string) => {
        const stampKey = `nourish.nudge.${key}`
        try {
          const last = window.localStorage.getItem(stampKey)
          const today = new Date().toISOString().slice(0, 10)
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
    }

    evaluate()
    const id = window.setInterval(evaluate, 5 * 60_000)
    return () => window.clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permission, rules, logReady, accountReady, healthReady])

  const notify = (key: string) => {
    const messages: Record<string, { title: string; body: string }> = {
      streak: {
        title: `🔥 Don't lose your ${streak}-day streak!`,
        body: "Log a meal to keep your streak alive today.",
      },
      goal: {
        title: "🎯 You're still below your target",
        body: `Only ${Math.max(0, targets.calories - dayTotals(state.meals).calories)} kcal logged. Add a snack or dinner.`,
      },
      inactive: {
        title: "⏰ Time to log your meals",
        body: "Nothing logged today. It takes 30 seconds with the scanner!",
      },
    }
    const msg = messages[key]
    if (!msg) return
    try {
      new Notification(msg.title, { body: msg.body, tag: `nourish-${key}` })
      setLastNudge(key)
    } catch {
      // notification failed — silently ignore
    }
  }

  const enable = async () => {
    if (!("Notification" in window)) return
    const res = await Notification.requestPermission()
    setPermission(res)
    if (res === "granted") {
      new Notification("Nourish notifications on 🔔", {
        body: "We'll nudge you to keep your streak and reach your goal.",
      })
    }
  }

  return <Context.Provider value={{ permission, enable, lastNudge, rules }}>{children}</Context.Provider>
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
