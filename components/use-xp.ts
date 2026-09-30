"use client"

import { useMemo } from "react"
import { mealOrder, useFoodLog } from "@/lib/food-log"
import { computeXp, FULL_DAY_MIN_ENTRIES, type XpDay, type XpSummary } from "@/lib/xp"

/**
 * XP / niveau de l'utilisateur, calculés localement depuis SON journal — donc
 * disponibles instantanément (aucun aller-retour réseau) et identiques au
 * classement serveur, qui applique exactement le même barème (`lib/xp.ts`).
 */
export function useXp(): XpSummary {
  const { state } = useFoodLog()

  return useMemo(() => {
    const days: XpDay[] = state.history.map((h) => ({
      date: h.date,
      // Le compte exact d'aliments est stocké depuis l'arrivée de l'XP. Pour
      // les journées archivées avant, on ne peut pas le retrouver : prise comme
      // une journée complète dès qu'elle contient des calories (mieux vaut une
      // légère sous-estimation qu'un utilisateur pénalisé sur son historique).
      entries: h.entries ?? (h.calories > 0 ? FULL_DAY_MIN_ENTRIES : 0),
    }))
    // La journée en cours ferme la marche — mais uniquement si elle contient
    // quelque chose : une journée encore vide ne doit ni compter comme
    // journalisée ni prolonger la série (même règle que le classement serveur).
    const todayEntries = mealOrder.reduce((n, k) => n + state.meals[k].length, 0)
    if (todayEntries > 0 || state.water > 0) days.push({ date: state.date, entries: todayEntries })
    return computeXp(days, state.date)
  }, [state])
}
