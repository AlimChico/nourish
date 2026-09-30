"use client"

import { useMemo } from "react"
import { useFoodLog } from "@/lib/food-log"
import { useHealth } from "@/lib/health"
import { shiftDateKey } from "@/lib/date-key"

/**
 * Daily streak = consecutive days (ending today or yesterday) with at least
 * one meal logged OR a meaningful number of steps (> 3000 credits an active
 * day even without food entries).
 */
export function useStreak(): number {
  const { state, history } = useFoodLog()
  const { state: health } = useHealth()

  return useMemo(() => {
    const todaySteps = health.days[state.date]?.steps ?? 0
    const hasTodayActivity =
      Object.values(state.meals).some((m) => m.length > 0) || todaySteps > 3000

    let cursor = hasTodayActivity ? 0 : 1
    let count = 0
    for (; cursor < 365; cursor++) {
      const iso = shiftDateKey(state.date, -cursor)

      if (iso === state.date) {
        count++
        continue
      }
      const hist = history.find((h) => h.date === iso)
      const daySteps = health.days[iso]?.steps ?? 0
      const hit = (hist && hist.calories > 0) || daySteps > 3000
      if (!hit) break
      count++
    }
    return count
  }, [state.date, state.meals, history, health.days])
}
