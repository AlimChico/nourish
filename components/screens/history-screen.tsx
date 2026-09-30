"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { X, RefreshCw, Loader2, ChevronDown, CalendarDays, Droplets, Utensils, CloudOff, Search } from "lucide-react"
import { BarChart } from "@/components/mini-charts"
import { useFoodLog, mealMeta, type MealKey } from "@/lib/food-log"
import { useAccount } from "@/lib/account"
import { useSync } from "@/lib/sync"
import { appDateKey, shiftDateKey } from "@/lib/date-key"
import {
  ARCHIVE_MEALS,
  countEntries,
  normalizeArchiveDay,
  readArchivedDays,
  toArchiveDay,
  totalsOf,
  type ArchiveDay,
} from "@/lib/day-archive"
import { cn } from "@/lib/utils"

const RANGES = [7, 30, 90] as const

/** « Today », « Yesterday », sinon « Mon 22 Sep ». */
function dayLabel(iso: string, todayIso: string): string {
  if (iso === todayIso) return "Today"
  if (iso === shiftDateKey(todayIso, -1)) return "Yesterday"
  try {
    return new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" })
  } catch {
    return iso
  }
}

function monthLabel(iso: string): string {
  try {
    return new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { month: "long", year: "numeric" })
  } catch {
    return iso
  }
}

/**
 * Historique des repas — au-delà d'aujourd'hui.
 *
 * Deux sources fusionnées : l'archive locale (`lib/day-archive.ts`, détaillée,
 * disponible hors-ligne) et les journées du serveur (`/api/sync/days`, jusqu'à
 * 400 jours, disponibles dès qu'un compte existe). La journée en cours vient du
 * journal vivant : elle doit refléter ce qui vient d'être ajouté.
 */
export function HistoryScreen({ onClose }: { onClose: () => void }) {
  const { state, hydrated } = useFoodLog()
  const { targets } = useAccount()
  const { status } = useSync()

  const [range, setRange] = useState<(typeof RANGES)[number]>(30)
  const [serverDays, setServerDays] = useState<ArchiveDay[]>([])
  const [localDays, setLocalDays] = useState<ArchiveDay[]>([])
  const [loading, setLoading] = useState(false)
  const [offline, setOffline] = useState(false)
  const [openDate, setOpenDate] = useState<string | null>(null)
  const [query, setQuery] = useState("")

  // Archive locale : lue au montage (localStorage n'existe pas côté serveur).
  useEffect(() => {
    if (!hydrated) return
    setLocalDays(readArchivedDays())
  }, [hydrated])

  const loadServer = useCallback(async (silent = false) => {
    if (status !== "authed") return
    if (!silent) setLoading(true)
    try {
      const res = await fetch("/api/sync/days", { cache: "no-store" })
      if (!res.ok) throw new Error(String(res.status))
      const payload = (await res.json()) as { days?: unknown[] }
      const days = (payload.days ?? [])
        .map(normalizeArchiveDay)
        .filter((d): d is ArchiveDay => !!d && (countEntries(d) > 0 || d.water > 0))
      setServerDays(days)
      setOffline(false)
    } catch {
      setOffline(true)
    } finally {
      setLoading(false)
    }
  }, [status])

  useEffect(() => {
    void loadServer()
  }, [loadServer])

  const todayIso = state.date

  /** Journées fusionnées : local d'abord (détail complet), serveur en complément. */
  const allDays = useMemo(() => {
    const byDate = new Map<string, ArchiveDay>()
    // Du plus ancien au plus récent pour que le local (plus récent) écrase le
    // serveur en cas de doublon.
    for (const d of serverDays) byDate.set(d.date, d)
    for (const d of localDays) byDate.set(d.date, d)
    const today = toArchiveDay(state)
    if (today && (countEntries(today) > 0 || today.water > 0 || byDate.has(today.date))) byDate.set(today.date, today)
    return [...byDate.values()].sort((a, b) => b.date.localeCompare(a.date))
  }, [serverDays, localDays, state])

  const filtered = useMemo(() => {
    const from = shiftDateKey(todayIso, -(range - 1))
    const q = query.trim().toLowerCase()
    return allDays.filter((d) => {
      if (d.date < from || d.date > todayIso) return false
      if (!q) return true
      // Recherche par aliment ou par date (« 22 sep », « lablabi »).
      const haystack = [
        d.date,
        dayLabel(d.date, todayIso),
        ...ARCHIVE_MEALS.flatMap((k) => d.meals[k].map((e) => e.name)),
      ]
        .join(" ")
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [allDays, range, query, todayIso])

  const summary = useMemo(() => {
    if (filtered.length === 0) return null
    const withFood = filtered.filter((d) => countEntries(d) > 0)
    const kcal = withFood.reduce((n, d) => n + totalsOf(d).calories, 0)
    const water = filtered.reduce((n, d) => n + d.water, 0)
    const best = withFood.reduce<ArchiveDay | null>(
      (top, d) => (!top || totalsOf(d).protein > totalsOf(top).protein ? d : top),
      null,
    )
    return {
      days: filtered.length,
      logged: withFood.length,
      avg: withFood.length > 0 ? Math.round(kcal / withFood.length) : 0,
      water,
      best,
      entries: filtered.reduce((n, d) => n + countEntries(d), 0),
    }
  }, [filtered])

  /** 14 derniers jours (kcal/jour) pour donner du contexte à la liste. */
  const chart = useMemo(() => {
    return Array.from({ length: 14 }, (_, i) => {
      const iso = shiftDateKey(todayIso, -(13 - i))
      const day = allDays.find((d) => d.date === iso)
      return {
        day: dayLabel(iso, todayIso).slice(0, 3),
        value: day ? totalsOf(day).calories : 0,
        target: day ? targets.calories : undefined,
      }
    })
  }, [allDays, todayIso, targets.calories])

  const grouped = useMemo(() => {
    const out: { month: string; days: ArchiveDay[] }[] = []
    for (const d of filtered) {
      const month = monthLabel(d.date)
      const last = out[out.length - 1]
      if (last && last.month === month) last.days.push(d)
      else out.push({ month, days: [d] })
    }
    return out
  }, [filtered])

  return (
    <div className="safe-top absolute inset-0 z-30 flex flex-col bg-background aurora-glow animate-slide-up sm:mx-auto sm:max-w-2xl sm:border-x sm:border-[#a7f3d0]/10 sm:shadow-2xl">
      {/* En-tête */}
      <div className="flex items-center justify-between px-5 py-3 sm:px-6">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-primary">
            <CalendarDays className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-lg font-extrabold leading-tight tracking-tight">Meal history</h1>
            <p className="text-xs text-muted-foreground">
              {summary
                ? `${summary.logged} logged day${summary.logged > 1 ? "s" : ""} · ${summary.entries} food entr${summary.entries > 1 ? "ies" : "y"}`
                : "Every day you have logged"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {status === "authed" && (
            <button
              type="button"
              onClick={() => void loadServer(true)}
              aria-label="Rafraîchir l'historique"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-muted"
            >
              <RefreshCw className={cn("h-4.5 w-4.5", loading && "animate-spin")} />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer l'historique"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-muted"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto no-scrollbar px-4 pb-[calc(env(safe-area-inset-bottom,0px)+24px)] sm:px-6">
        {/* Filtres : période + recherche */}
        <div className="flex items-center gap-2">
          <div className="flex flex-1 gap-1 rounded-2xl bg-muted p-1">
            {RANGES.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRange(r)}
                className={cn(
                  "flex-1 rounded-xl py-1.5 text-xs font-bold transition-all",
                  range === r ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
                )}
              >
                {r} days
              </button>
            ))}
          </div>
        </div>
        <label className="mt-2 flex items-center gap-2 rounded-2xl bg-card px-4 py-2.5 shadow-sm">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search a food or a date…"
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
          />
        </label>

        {/* Contexte : 14 derniers jours */}
        {allDays.length > 0 && (
          <section className="mt-3 rounded-3xl border border-[#a7f3d0]/10 bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-extrabold">Last 14 days</h2>
              {summary && (
                <span className="text-[11px] font-semibold text-muted-foreground">
                  avg {summary.avg.toLocaleString()} kcal / day
                </span>
              )}
            </div>
            <BarChart data={chart} unit="kcal" className="mt-3" />
          </section>
        )}

        {/* Hors-ligne / anonyme : expliquer honnêtement ce qui est disponible */}
        {offline && (
          <p className="mt-3 flex items-center gap-2 rounded-2xl border border-[#fbbf24]/25 bg-[#2a2410] p-3 text-xs font-semibold text-[#fde68a]">
            <CloudOff className="h-4 w-4 shrink-0" />
            Server unreachable — showing the days stored on this device.
          </p>
        )}
        {status !== "authed" && (
          <p className="mt-3 rounded-2xl bg-accent p-3 text-xs font-semibold text-accent-foreground">
            This device keeps the last 60 days with full detail. Create an account to keep your whole history safe
            and available on any phone.
          </p>
        )}
        {status === "authed" && loading && serverDays.length === 0 && (
          <p className="mt-3 flex items-center justify-center gap-2 rounded-2xl bg-card p-3 text-xs font-semibold text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading your history…
          </p>
        )}

        {/* Liste des journées */}
        {filtered.length === 0 ? (
          <div className="mt-4 rounded-3xl border border-[#a7f3d0]/10 bg-card p-6 text-center shadow-sm">
            <span className="text-3xl">🗓️</span>
            <p className="mt-2 text-base font-extrabold">
              {allDays.length === 0 ? "No history yet" : "Nothing in this period"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {allDays.length === 0
                ? "Log a meal today — from tomorrow, this page becomes your food diary archive."
                : "Try a longer period or clear your search."}
            </p>
          </div>
        ) : (
          grouped.map((group) => (
            <section key={group.month} className="mt-4">
              <h2 className="mb-2 px-1 text-sm font-bold uppercase tracking-wide text-muted-foreground">
                {group.month}
              </h2>
              <div className="space-y-2">
                {group.days.map((day) => {
                  const totals = totalsOf(day)
                  const count = countEntries(day)
                  const open = openDate === day.date
                  const pct = targets.calories > 0 ? Math.min(100, Math.round((totals.calories / targets.calories) * 100)) : 0
                  return (
                    <div
                      key={day.date}
                      className={cn(
                        "overflow-hidden rounded-2xl border border-[#a7f3d0]/10 bg-card shadow-sm",
                        day.date === todayIso && "border-primary/40 ring-1 ring-primary/25",
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => setOpenDate(open ? null : day.date)}
                        aria-expanded={open}
                        className="flex w-full items-center gap-3 p-3.5 text-left"
                      >
                        <span className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-xl bg-accent text-primary">
                          <span className="text-[15px] font-extrabold leading-none tabular-nums">
                            {day.date.slice(8, 10)}
                          </span>
                          <span className="text-[9px] font-bold uppercase leading-none">
                            {dayLabel(day.date, todayIso).slice(0, 3)}
                          </span>
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-baseline justify-between gap-2">
                            <span className="truncate text-sm font-extrabold">{dayLabel(day.date, todayIso)}</span>
                            <span className="shrink-0 text-sm font-extrabold tabular-nums text-primary">
                              {totals.calories.toLocaleString()}
                              <span className="ml-0.5 text-[10px] font-bold text-muted-foreground">kcal</span>
                            </span>
                          </span>
                          <span className="mt-0.5 block truncate text-[11px] font-semibold text-muted-foreground">
                            {count} food{count > 1 ? "s" : ""} · P {totals.protein}g · C {totals.carbs}g · F {totals.fat}g
                            {day.water > 0 && ` · 💧 ${day.water}`}
                          </span>
                          {/* Barre toujours visible, même à 0 % (#44) */}
                          <span className="mt-1.5 block h-1.5 w-full overflow-hidden rounded-full bg-muted">
                            <span
                              className="block h-full rounded-full bg-gradient-to-r from-primary to-[#a7f3d0]"
                              style={{ width: `${Math.max(pct, count > 0 ? 4 : 2)}%` }}
                            />
                          </span>
                        </span>
                        <ChevronDown
                          className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
                        />
                      </button>

                      {open && (
                        <div className="border-t border-border/60 px-3.5 pb-3.5 pt-2.5">
                          {count === 0 ? (
                            <p className="py-2 text-center text-xs font-semibold text-muted-foreground">
                              {day.water > 0 ? `Only water logged (${day.water} glasses).` : "Nothing logged this day."}
                            </p>
                          ) : (
                            <div className="space-y-2.5">
                              {ARCHIVE_MEALS.map((key) => {
                                const entries = day.meals[key]
                                if (entries.length === 0) return null
                                const meta = mealMeta[key as MealKey]
                                const mealKcal = Math.round(
                                  entries.reduce((n, e) => n + e.calories * e.quantity, 0),
                                )
                                return (
                                  <div key={key}>
                                    <p className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                                      <span>
                                        {meta.emoji} {meta.name}
                                      </span>
                                      <span className="tabular-nums">{mealKcal} kcal</span>
                                    </p>
                                    <ul className="mt-1 space-y-1">
                                      {entries.map((e, i) => (
                                        <li
                                          key={`${e.name}-${i}`}
                                          className="flex items-center gap-2 rounded-xl bg-muted/40 px-2.5 py-1.5"
                                        >
                                          <span aria-hidden className="text-base">
                                            {e.emoji}
                                          </span>
                                          <span className="min-w-0 flex-1 truncate text-xs font-semibold">
                                            {e.name}
                                            {e.quantity > 1 && (
                                              <span className="ml-1 text-muted-foreground">×{e.quantity}</span>
                                            )}
                                          </span>
                                          <span className="shrink-0 text-xs font-bold tabular-nums text-muted-foreground">
                                            {Math.round(e.calories * e.quantity)} kcal
                                          </span>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )
                              })}
                              <div className="flex items-center gap-3 rounded-xl bg-accent px-3 py-2 text-[11px] font-bold text-accent-foreground">
                                <span className="flex items-center gap-1">
                                  <Utensils className="h-3.5 w-3.5" /> {count} entries
                                </span>
                                {day.water > 0 && (
                                  <span className="flex items-center gap-1">
                                    <Droplets className="h-3.5 w-3.5" /> {day.water} glasses
                                  </span>
                                )}
                                <span className="ml-auto tabular-nums">
                                  {pct}% of your {targets.calories} kcal target
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </section>
          ))
        )}

        <p className="mt-5 text-center text-[11px] font-semibold text-muted-foreground">
          Need a full backup? Settings → Export my data downloads everything as JSON.
        </p>
      </div>
    </div>
  )
}
