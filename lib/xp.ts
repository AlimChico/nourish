/**
 * Moteur XP / niveaux — PUR (aucun accès réseau ni React) : le même code sert
 * côté serveur (calcul du classement) et côté client (affichage immédiat).
 *
 * ── BARÈME (volontairement simple et anti-abus) ─────────────────────────────
 *  • +10 XP par aliment enregistré, plafonné à 10 aliments comptés par jour
 *    (100 XP/jour max : logger 40 aliments n'apporte rien de plus) ;
 *  • +20 XP bonus pour une journée « complète » (au moins 3 aliments) ;
 *  • +5 XP par jour de série consécutive, plafonné à +50 XP.
 *  Maximum atteignable : 170 XP par jour.
 *
 * ── NIVEAUX ────────────────────────────────────────────────────────────────
 *  Le palier pour passer du niveau L au niveau L+1 vaut 100 + (L−1)×50 XP :
 *  100, 150, 200, 250… (cumul : 100, 250, 450, 700, 1000…). Un utilisateur qui
 *  tient son journal tous les jours monte d'un niveau tous les 1 à 2 jours au
 *  début, puis de plus en plus lentement.
 */

import { isNextDayKey } from "@/lib/date-key"

export const XP_PER_ENTRY = 10
export const MAX_ENTRIES_PER_DAY = 10
export const FULL_DAY_BONUS = 20
export const FULL_DAY_MIN_ENTRIES = 3
export const STREAK_XP_PER_DAY = 5
export const STREAK_XP_CAP = 50
export const MAX_DAILY_XP = XP_PER_ENTRY * MAX_ENTRIES_PER_DAY + FULL_DAY_BONUS + STREAK_XP_CAP

export const LEVEL_TITLES = [
  "Débutant",
  "Régulier",
  "Assidu",
  "Discipliné",
  "Confirmé",
  "Expert",
  "Champion",
  "Légende Sahtek",
]

export type XpDay = { date: string; entries: number }

export type LevelInfo = {
  level: number
  title: string
  /** XP déjà accumulés dans le niveau courant. */
  intoLevel: number
  /** XP nécessaires pour atteindre le niveau suivant. */
  forNext: number
  /** 0..1 — progression vers le niveau suivant. */
  progress: number
}

/** XP nécessaires pour passer du niveau `level` au suivant. */
export function xpForLevelStep(level: number): number {
  return 100 + (Math.max(1, level) - 1) * 50
}

/** Niveau + titre + progression pour un total d'XP donné. */
export function levelForXp(totalXp: number): LevelInfo {
  let level = 1
  let rest = Math.max(0, Math.round(totalXp))
  let need = xpForLevelStep(level)
  // Borne de sécurité : 500 niveaux max (aucun risque de boucle infinie).
  while (rest >= need && level < 500) {
    rest -= need
    level += 1
    need = xpForLevelStep(level)
  }
  return {
    level,
    title: LEVEL_TITLES[Math.min(level - 1, LEVEL_TITLES.length - 1)] ?? "Débutant",
    intoLevel: rest,
    forNext: need,
    progress: need > 0 ? Math.min(1, rest / need) : 0,
  }
}

export type XpSummary = {
  totalXp: number
  level: LevelInfo
  /** Série de jours consécutifs avec au moins un aliment loggé. */
  streak: number
  bestStreak: number
  daysTracked: number
  todayXp: number
  todayEntries: number
}

/**
 * Calcule l'XP cumulé et la série à partir des journées journalisées.
 * `days` : une entrée par jour effectivement loggé (date YYYY-MM-DD + nombre
 * d'aliments). Le bonus de série est attribué selon la position dans la chaîne.
 */
export function computeXp(days: XpDay[], todayIso: string): XpSummary {
  const byDate = new Map<string, number>()
  for (const d of days) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date)) continue
    byDate.set(d.date, Math.max(0, Math.floor(d.entries)))
  }
  const dates = [...byDate.keys()].sort()
  const daysTracked = dates.length

  let totalXp = 0
  let bestStreak = 0
  let run = 0
  let previous: string | null = null

  for (const date of dates) {
    const entries = byDate.get(date) ?? 0
    const consecutive = previous !== null && isNextDayKey(previous, date)
    run = consecutive ? run + 1 : 1
    previous = date
    if (run > bestStreak) bestStreak = run

    const counted = Math.min(entries, MAX_ENTRIES_PER_DAY)
    totalXp += counted * XP_PER_ENTRY
    if (entries >= FULL_DAY_MIN_ENTRIES) totalXp += FULL_DAY_BONUS
    totalXp += Math.min(STREAK_XP_CAP, (run - 1) * STREAK_XP_PER_DAY)
  }

  // Série « en cours » : elle n'est vivante que si le dernier jour loggé est
  // aujourd'hui ou hier (sinon la série est cassée).
  const last = dates[dates.length - 1]
  let streak = 0
  if (last === todayIso || (last && isNextDayKey(last, todayIso))) {
    streak = run
  }

  const todayEntries = byDate.get(todayIso) ?? 0
  const todayXp = computeDayXp(todayEntries, todayEntries > 0 ? streak : 0)

  return {
    totalXp,
    level: levelForXp(totalXp),
    streak,
    bestStreak,
    daysTracked,
    todayXp,
    todayEntries,
  }
}

/** XP d'une journée isolée (sert au gain « du jour » affiché). */
export function computeDayXp(entries: number, streakDay = 0): number {
  const counted = Math.min(Math.max(0, Math.floor(entries)), MAX_ENTRIES_PER_DAY)
  let xp = counted * XP_PER_ENTRY
  if (entries >= FULL_DAY_MIN_ENTRIES) xp += FULL_DAY_BONUS
  xp += Math.min(STREAK_XP_CAP, Math.max(0, streakDay - 1) * STREAK_XP_PER_DAY)
  return xp
}

/**
 * Activité d'une journée depuis le JSON stocké (`meals` = 4 listes d'entrées,
 * `water` = verres). Sert au calcul d'XP côté serveur.
 *
 * Une journée sans aliment NI eau n'est PAS une journée journalisée : la
 * compter ferait grimper la série et l'XP sur des journées vides (l'app crée
 * une ligne de jour à chaque synchro, même vide). Le client applique le même
 * filtre à l'archivage de ses journées → les deux calculs coïncident.
 */
export function dayActivityFromData(data: unknown): { entries: number; water: number } {
  let parsed: unknown = data
  if (typeof data === "string") {
    try {
      parsed = JSON.parse(data)
    } catch {
      return { entries: 0, water: 0 }
    }
  }
  const day = parsed as { meals?: Record<string, unknown>; water?: unknown } | null
  const meals = day?.meals
  let total = 0
  if (meals && typeof meals === "object") {
    for (const value of Object.values(meals)) {
      if (Array.isArray(value)) total += value.length
    }
  }
  const water = typeof day?.water === "number" && isFinite(day.water) ? Math.max(0, day.water) : 0
  return { entries: total, water }
}
