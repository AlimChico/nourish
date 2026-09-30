/**
 * Clé de jour de l'app (YYYY-MM-DD) — UNE seule définition, partagée client et
 * serveur, calée sur le fuseau tunisien.
 *
 * Pourquoi pas `toISOString().slice(0,10)` (UTC) comme avant : en Tunisie
 * (UTC+1), la journée UTC bascule à **01:00 du matin heure locale**. Un repas
 * saisi à 00:30 était donc archivé sur la veille, la série (streak) se cassait
 * et la journée « en cours » se terminait une heure trop tard. En prenant le
 * fuseau de l'app, la journée bascule à minuit pile, et le client comme le
 * serveur comptent exactement la même chose — indispensable pour l'XP et le
 * classement, agrégés côté serveur (dont l'horloge est en UTC).
 */

/** Fuseau de référence de l'app : Tunisie (sans heure d'été depuis 2009). */
export const APP_TIMEZONE = "Africa/Tunis"

const formatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})

/** Clé de jour (YYYY-MM-DD) dans le fuseau de l'app, pour n'importe quelle date. */
export function appDateKey(date: Date = new Date()): string {
  try {
    return formatter.format(date)
  } catch {
    // Environnement sans données de fuseau : repli sur l'horloge locale.
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, "0")
    const d = String(date.getDate()).padStart(2, "0")
    return `${y}-${m}-${d}`
  }
}

/** Clé de jour d'aujourd'hui. */
export function todayKey(date: Date = new Date()): string {
  return appDateKey(date)
}

/**
 * `iso` décalé de `days` jours. On travaille à midi UTC pour qu'un décalage de
 * fuseau ne puisse jamais faire basculer la date d'un cran.
 */
export function shiftDateKey(iso: string, days: number): string {
  const base = new Date(`${iso}T12:00:00Z`)
  if (isNaN(base.getTime())) return iso
  base.setUTCDate(base.getUTCDate() + days)
  return appDateKey(base)
}

/** `a` est-il le lendemain de `b` (clés de jour) ? */
export function isNextDayKey(previous: string, candidate: string): boolean {
  return shiftDateKey(previous, 1) === candidate
}
