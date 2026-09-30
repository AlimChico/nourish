/**
 * Archive LOCALE des journées terminées, avec le détail des repas.
 *
 * Pourquoi une archive séparée du journal : le journal ne garde que le jour en
 * cours — une fois la journée basculée, il n'en reste que les totaux. Ici on
 * conserve le *détail utile* (nom, portion, calories, macros) pour que
 * l'historique des repas soit consultable, même hors-ligne et sans compte.
 *
 * Ce qui n'est JAMAIS archivé : la photo du plat (jusqu'à 120 Ko par entrée !)
 * et les identifiants internes. 60 jours maximum, ~10 Ko au total.
 */

const KEY = "sahtek.day-archive.v1"
const MAX_DAYS = 60
const MAX_ENTRIES_PER_MEAL = 60

export const ARCHIVE_MEALS = ["breakfast", "lunch", "dinner", "snacks"] as const
export type ArchiveMealKey = (typeof ARCHIVE_MEALS)[number]

export type ArchiveEntry = {
  name: string
  emoji: string
  quantity: number
  calories: number
  protein: number
  carbs: number
  fat: number
}

export type ArchiveDay = {
  date: string
  meals: Record<ArchiveMealKey, ArchiveEntry[]>
  water: number
}

export type ArchiveTotals = { calories: number; protein: number; carbs: number; fat: number }

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function num(v: unknown, max = 100_000): number {
  const n = typeof v === "number" && isFinite(v) ? v : 0
  return Math.max(0, Math.min(max, Math.round(n)))
}

function cleanString(v: unknown, max: number): string {
  return typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : ""
}

/**
 * Une entrée, dans L'UNE des deux formes possibles :
 *  • journal (et journée du serveur) : `{ quantity, food: { name, calories… } }` ;
 *  • archive déjà convertie : `{ quantity, name, calories… }` (champs à plat).
 * Les deux doivent être relisibles : sinon, relire l'archive locale donnerait
 * des journées vides — bug silencieux, l'historique semblerait effacé.
 */
type LogLikeEntry = { quantity?: unknown; food?: Record<string, unknown> | null } & Record<string, unknown>
type LogLikeDay = { date?: unknown; water?: unknown; meals?: Record<string, unknown> | null }

/** Convertit une journée (journal OU archive) en journée d'archive canonique. */
export function toArchiveDay(day: LogLikeDay): ArchiveDay | null {
  const date = typeof day?.date === "string" && DATE_RE.test(day.date) ? day.date : null
  if (!date) return null
  const meals = {} as Record<ArchiveMealKey, ArchiveEntry[]>
  for (const key of ARCHIVE_MEALS) {
    const list = Array.isArray(day.meals?.[key]) ? (day.meals?.[key] as LogLikeEntry[]) : []
    meals[key] = list.slice(0, MAX_ENTRIES_PER_MEAL).map((e) => {
      const src = ((e?.food ?? e) ?? {}) as Record<string, unknown>
      const qty = Math.max(1, Math.min(99, Math.round(Number(e?.quantity) || 1)))
      return {
        name: cleanString(src.name, 80) || "Food",
        emoji: cleanString(src.emoji, 8) || "🍽️",
        quantity: qty,
        calories: num(src.calories, 20_000),
        protein: num(src.protein, 2_000),
        carbs: num(src.carbs, 2_000),
        fat: num(src.fat, 2_000),
      }
    })
  }
  return { date, meals, water: num(day.water, 50) }
}

/** Normalise un objet quelconque (localStorage, serveur) en journée d'archive. */
export function normalizeArchiveDay(raw: unknown): ArchiveDay | null {
  return toArchiveDay((raw ?? {}) as LogLikeDay)
}

export function totalsOf(day: ArchiveDay): ArchiveTotals {
  const out: ArchiveTotals = { calories: 0, protein: 0, carbs: 0, fat: 0 }
  for (const key of ARCHIVE_MEALS) {
    for (const e of day.meals[key]) {
      out.calories += e.calories * e.quantity
      out.protein += e.protein * e.quantity
      out.carbs += e.carbs * e.quantity
      out.fat += e.fat * e.quantity
    }
  }
  out.calories = Math.round(out.calories)
  out.protein = Math.round(out.protein)
  out.carbs = Math.round(out.carbs)
  out.fat = Math.round(out.fat)
  return out
}

export function countEntries(day: ArchiveDay): number {
  return ARCHIVE_MEALS.reduce((n, k) => n + day.meals[k].length, 0)
}

/** Lit l'archive locale (du plus récent au plus ancien). Ne jette jamais. */
export function readArchivedDays(): ArchiveDay[] {
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .map(normalizeArchiveDay)
      .filter((d): d is ArchiveDay => !!d)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, MAX_DAYS)
  } catch {
    return []
  }
}

/**
 * Ajoute (ou remplace) une journée dans l'archive. Idempotent : archiver deux
 * fois la même date ne duplique rien, et une journée vide n'est pas conservée.
 */
export function archiveDay(day: ArchiveDay | null): void {
  if (!day) return
  if (countEntries(day) === 0 && day.water === 0) return
  try {
    const rest = readArchivedDays().filter((d) => d.date !== day.date)
    const next = [day, ...rest].sort((a, b) => b.date.localeCompare(a.date)).slice(0, MAX_DAYS)
    window.localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // Stockage plein ou indisponible : l'historique détaillé est un confort,
    // il ne doit jamais empêcher l'application de fonctionner.
  }
}

/** Archive une journée du journal en cours de bascule. */
export function archiveFromLog(day: LogLikeDay): void {
  archiveDay(toArchiveDay(day))
}

export function clearArchive(): void {
  try {
    window.localStorage.removeItem(KEY)
  } catch {
    // ignore
  }
}
