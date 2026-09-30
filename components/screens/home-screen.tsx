"use client"

import { useMemo, useState } from "react"
import {
  Minus,
  Plus,
  Trash2,
  Share2,
  Check,
  Flame,
  Footprints,
  Droplets,
  Dumbbell,
  Beef,
  Sparkles,
  Camera,
  ChevronRight,
} from "lucide-react"
import { AnimatedCounter } from "@/components/animated-counter"
import { ProgressRing } from "@/components/progress-ring"
import { OfflineBanner } from "@/components/offline-banner"
import { macroMeta, type MacroKey } from "@/lib/nutrition-data"
import { dayTotals, mealMeta, mealOrder, totalsFor, useFoodLog, type MealKey } from "@/lib/food-log"
import type { FoodItem } from "@/lib/food-log"
import { suggestRecipes } from "@/lib/food-requests"
import { useAccount } from "@/lib/account"
import { useHealth } from "@/lib/health"
import { useStreak } from "@/components/use-streak"
import { AdSlot, AD_SLOTS } from "@/components/ad-slot"
import { useXp } from "@/components/use-xp"
import { appDateKey } from "@/lib/date-key"
import { barWidth, cn } from "@/lib/utils"
import { haptic } from "@/lib/haptic"
import { useT, useWeekLetters } from "@/lib/i18n"

const dayKeyOf = (d: Date) => appDateKey(d)

/** « 3/8 », et « 8+ » si l'eau a été saisie au-delà de l'objectif (jamais négatif). */
function waterLabel(water: number, goal: number): string {
  const w = Math.max(0, water)
  const g = Math.max(1, goal)
  return w > g ? `${g}+/${g}` : `${w}/${g}`
}

function timeLabel(at?: number): string {
  if (!at) return ""
  try {
    return new Date(at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
  } catch {
    return ""
  }
}

/** Nom du repas traduit — `mealMeta` ne contient que les sources anglaises. */
function useMealName(): (key: MealKey) => string {
  const t = useT()
  return (key) => t(mealMeta[key].name)
}

/** Dynamic motivational line — derived only from the user's real numbers. */
function motivationFor({
  eaten,
  target,
  remaining,
  hasLogged,
  hour,
}: {
  eaten: number
  target: number
  remaining: number
  hasLogged: boolean
  hour: number
}): { emoji: string; text: string } {
  if (!hasLogged) {
    return hour >= 16
      ? { emoji: "⏰", text: "The day isn't over — log your meals to keep your streak alive." }
      : { emoji: "🔥", text: "Log your first meal to ignite today's streak." }
  }
  if (target > 0 && eaten > target) {
    return { emoji: "🧊", text: "Over budget — a walk and a light dinner will balance the day." }
  }
  if (remaining <= target * 0.1 && target > 0) {
    return { emoji: "🏁", text: "Almost at your goal — finish strong and on target!" }
  }
  if (eaten >= target * 0.75) {
    return { emoji: "⚡", text: "Strong pace today — keep your meals balanced to land right on goal." }
  }
  if (eaten >= target * 0.5) {
    return { emoji: "💪", text: "Halfway there — stay consistent, your goal is within reach." }
  }
  return { emoji: "🚀", text: "Great start — fuel smart and keep the momentum going." }
}

export function HomeScreen({
  onAddFood,
  onOpenSettings,
  onOpenCoach,
  onOpenLeaderboard,
}: {
  onAddFood: (meal?: MealKey) => void
  onOpenSettings: () => void
  onOpenCoach?: () => void
  onOpenLeaderboard?: () => void
}) {
  const weekLetters = useWeekLetters()
  const { state, addWater } = useFoodLog()
  const { state: account, targets } = useAccount()
  const {
    today: health,
    state: healthState,
    sensorAvailable,
    sensorPermission,
    enableSensor,
    addSteps,
    addWorkout,
  } = useHealth()
  const streak = useStreak()
  const xp = useXp()
  const t = useT()

  const totals = useMemo(() => dayTotals(state.meals), [state.meals])
  const eaten = Math.round(totals.calories)
  const target = Math.round(targets.calories)
  const remaining = Math.max(target - eaten, 0)
  const isOver = target > 0 && eaten > target
  const pctRaw = target > 0 ? (eaten / target) * 100 : 0
  const pct = Math.min(pctRaw, 100)
  const burn = health.workoutMinutes * 8
  const hasLogged = Object.values(state.meals).some((m) => m.length > 0)
  const firstName = account.name.trim().split(/\s+/)[0] ?? ""
  const hour = new Date().getHours()
  const greeting = t(hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening")
  const motivation = motivationFor({ eaten, target, remaining, hasLogged, hour })

  /**
   * Repas scannés du jour, du plus récent au plus ancien : la photo, les
   * calories et les macros restent affichés sur le dashboard. Le tableau est
   * dérivé du journal → la carte apparaît IMMÉDIATEMENT après un scan, sans
   * navigation ni rafraîchissement.
   */
  const scans = useMemo(
    () =>
      mealOrder
        .flatMap((meal) =>
          state.meals[meal]
            .filter((e) => !!e.food.photo || e.food.scanned === true)
            .map((e) => ({
              entryId: e.entryId,
              food: e.food,
              quantity: e.quantity,
              meal,
              at: typeof e.loggedAt === "number" ? e.loggedAt : 0,
            })),
        )
        .sort((a, b) => b.at - a.at),
    [state.meals],
  )
  const lastScan = scans[0] ?? null

  /** Current week (Mon → Sun), real data: history calories or today's live totals + steps. */
  const weekDays = useMemo(() => {
    const labels = weekLetters
    const now = new Date()
    const startOffset = (now.getDay() + 6) % 7 // days since Monday
    return labels.map((label, i) => {
      const d = new Date(now)
      d.setDate(now.getDate() - startOffset + i)
      const key = dayKeyOf(d)
      const isToday = key === state.date
      const isFuture = key > state.date
      const calories = isToday ? totals.calories : state.history.find((h) => h.date === key)?.calories ?? 0
      const steps = healthState.days[key]?.steps ?? 0
      return { label, key, isToday, isFuture, complete: calories > 0 || steps > 3000 }
    })
  }, [state.date, state.history, state.meals, totals.calories, healthState.days, weekLetters])

  return (
    <div className="mx-auto flex w-full flex-col gap-4 px-4 pb-4 pt-2 sm:gap-5 sm:px-6 sm:pb-6">
      {/* ── En-tête ── */}
      <header className="flex items-center justify-between pt-1">
        <div className="min-w-0">
          <h1 className="truncate text-[clamp(1.25rem,4.5vw,1.75rem)] font-extrabold tracking-tight">
            {greeting}
            {firstName ? `, ${firstName}` : ""} 👋
          </h1>
          <p className="text-sm text-muted-foreground">{t("Let's reach your goal today.")}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onOpenCoach}
            aria-label="Ouvrir le coach IA"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-[#a7f3d0]/15 bg-accent text-primary transition-transform active:scale-90"
          >
            <Sparkles className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={onOpenSettings}
            aria-label="Open settings"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-[#a7f3d0]/15 bg-secondary text-sm font-bold text-primary-foreground transition-transform active:scale-90"
          >
            {firstName ? firstName.slice(0, 2).toUpperCase() : "SA"}
          </button>
        </div>
      </header>

      {/* Hors-ligne / synchro : tout est gardé en local, re-poussé au retour */}
      <OfflineBanner />

      {/* ══ a) Résumé kcal + f) objectifs (eau, workout) fusionnés — un seul bloc ══ */}
      <section
        // Carte « héro » TOUJOURS sombre : `.surface-dark` (globals.css) y
        // redéfinit les jetons de couleur pour tout le sous-arbre. En clair, les
        // étiquettes « Water / Workout / Burn » étaient écrites en encre foncée
        // sur ce fond sombre — illisibles (contraste ~1,3:1).
        className="surface-dark relative overflow-hidden rounded-[1.9rem] border border-[#a7f3d0]/12 bg-gradient-to-b from-[#11251b] to-[#0d1a13] p-5 shadow-[0_18px_44px_rgba(0,0,0,0.4)] sm:p-6"
      >
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:justify-center sm:gap-12 lg:gap-16">
          <ProgressRing
            value={eaten}
            max={Math.max(target, 1)}
            strokeWidth={13}
            className="w-44 shrink-0 sm:w-44 lg:w-52"
            trackClassName="text-[#a7f3d0]/10"
            progressClassName={isOver ? "text-destructive" : "text-calories"}
          >
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
              {t(isOver ? "Over budget" : "Remaining")}
            </p>
            <p
              className={cn(
                "mt-0.5 text-[clamp(2rem,7vw,2.6rem)] font-black leading-none tabular-nums tracking-tight",
                isOver ? "text-destructive" : "text-[#e6fff1]",
              )}
            >
              <AnimatedCounter value={isOver ? eaten - target : remaining} />
            </p>
            <p className="mt-1 text-xs font-bold text-muted-foreground">kcal</p>
            <p className="mt-2 rounded-full bg-muted/60 px-2.5 py-1 text-[10px] font-bold tabular-nums text-muted-foreground">
              {t("{done} / {goal} eaten", { done: eaten.toLocaleString(), goal: target.toLocaleString() })}
            </p>
          </ProgressRing>

          {/* Objectifs du jour — eau + workout, dans la carte du résumé (pas de section en double) */}
          <div className="flex w-full flex-col gap-3.5 sm:w-52 sm:shrink-0">
            <GoalRow
              icon={<Droplets className="h-4 w-4" />}
              iconBg="bg-water-soft"
              iconTone="text-water"
              label={t("Water")}
              value={waterLabel(state.water, targets.water)}
              progress={Math.min((state.water / Math.max(targets.water, 1)) * 100, 100)}
              bar="bg-water"
              right={
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      haptic("light")
                      addWater(-1, targets.water)
                    }}
                    disabled={state.water <= 0}
                    aria-label="Remove a glass of water"
                    className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted text-foreground active:scale-90 disabled:opacity-40"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      haptic("success")
                      addWater(1, targets.water)
                    }}
                    disabled={state.water >= targets.water}
                    aria-label="Add a glass of water"
                    className="flex h-7 w-7 items-center justify-center rounded-lg bg-water text-[#e6fff1] active:scale-95 disabled:opacity-40"
                  >
                    {state.water >= targets.water ? (
                      <Check className="h-3.5 w-3.5" strokeWidth={3} />
                    ) : (
                      <Plus className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              }
            />
            <GoalRow
              icon={<Dumbbell className="h-4 w-4" />}
              iconBg="bg-fat-soft"
              iconTone="text-fat"
              label={t("Workout")}
              value={`${health.workoutMinutes} / 30 min`}
              progress={Math.min((health.workoutMinutes / 30) * 100, 100)}
              bar="bg-fat"
              right={
                <button
                  type="button"
                  onClick={() => addWorkout(15)}
                  aria-label="Add 15 minutes of workout"
                  className="rounded-lg bg-muted px-2 py-1 text-[11px] font-bold active:scale-95"
                >
                  +15
                </button>
              }
            />
            <div className="grid grid-cols-2 gap-2">
              <QuickStat icon={<Flame className="h-3.5 w-3.5" />} tone="text-fat" label={t("Burn")} value={`${burn} kcal`} />
              <QuickStat
                icon={<Footprints className="h-3.5 w-3.5" />}
                tone="text-steps"
                label={t("Steps")}
                value={health.steps.toLocaleString()}
              />
            </div>
          </div>
        </div>

        <p className="mt-4 text-center text-[11px] font-semibold text-muted-foreground sm:text-left">
          {isOver
            ? t("{n} kcal above your daily goal", { n: (eaten - target).toLocaleString() })
            : t("{pct}% of today's {goal} kcal goal", { pct: pct.toFixed(0), goal: target.toLocaleString() })}
        </p>
      </section>

      {/* ══ b) Dernier repas scanné — photo + kcal + macros, immédiatement ══ */}
      {lastScan && <LastScanCard scan={lastScan} others={scans.slice(1, 6)} onOpenMeals={() => onAddFood(lastScan.meal)} />}

      {/* ══ c) Ajouter un aliment ══ */}
      <button
        type="button"
        onClick={() => onAddFood()}
        className="flex items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 text-base font-bold text-primary-foreground shadow-lg shadow-primary/25 transition-transform active:scale-[0.98] sm:mx-auto sm:w-full sm:max-w-sm"
      >
        <Plus className="h-5 w-5" strokeWidth={2.5} />
        {t("Add food")}
      </button>

      {/* ══ d) Streak + macros du jour regroupés dans une seule carte ══ */}
      <section className="rounded-3xl border border-[#a7f3d0]/10 bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-1.5 text-base font-extrabold tracking-tight">
            <span aria-hidden>🔥</span>
            {t("{n} day streak", { n: streak })}
          </h2>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t("This week")}</span>
        </div>
        <div className="mt-3 flex items-start justify-between px-0.5">
          {weekDays.map((d) => (
            <div key={d.key} className="flex flex-col items-center gap-1.5" title={`${d.key}${d.complete ? " — done" : ""}`}>
              <span
                aria-hidden
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full transition-all",
                  d.isFuture && "border border-dashed border-border text-transparent",
                  !d.isFuture && !d.complete && !d.isToday && "border border-muted-foreground/30 bg-transparent text-transparent",
                  d.complete && "bg-primary text-primary-foreground",
                  !d.isFuture && !d.complete && d.isToday &&
                    "border-2 border-primary bg-primary/10 text-primary shadow-[0_0_14px_rgba(52,211,153,0.35)]",
                  d.complete && d.isToday && "ring-2 ring-primary/40 ring-offset-2 ring-offset-card",
                )}
              >
                {d.complete ? (
                  <Check className="h-4 w-4" strokeWidth={3.5} />
                ) : d.isToday ? (
                  <span className="h-2 w-2 rounded-full bg-primary" aria-hidden />
                ) : (
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" aria-hidden />
                )}
              </span>
              <span
                className={cn(
                  "text-[10px] font-bold leading-none",
                  d.isToday ? "text-primary" : d.isFuture ? "text-muted-foreground/50" : "text-muted-foreground",
                )}
              >
                {d.label}
              </span>
            </div>
          ))}
        </div>

        <div className="my-3.5 h-px bg-border" />

        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {(Object.keys(macroMeta) as MacroKey[]).map((key) => (
            <MacroMini key={key} macroKey={key} value={Math.round(totals[key])} target={targets[key]} />
          ))}
        </div>
      </section>

      {/* ══ Niveau / XP — barre de progression visible, ouvrable sur le classement ══ */}
      <button
        type="button"
        onClick={() => {
          haptic()
          onOpenLeaderboard?.()
        }}
        className="w-full rounded-3xl border border-[#a7f3d0]/10 bg-card p-4 text-left shadow-sm transition-transform active:scale-[0.99]"
      >
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-[#0f766e] text-lg font-extrabold text-primary-foreground shadow-[0_6px_18px_rgba(52,211,153,0.35)]"
          >
            {xp.level.level}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <p className="truncate text-sm font-extrabold tracking-tight">
                {t("Level {n}", { n: xp.level.level })}
                <span className="ml-1.5 font-bold text-muted-foreground">{xp.level.title}</span>
              </p>
              <span className="shrink-0 text-xs font-extrabold tabular-nums text-primary">
                {xp.totalXp.toLocaleString()} XP
              </span>
            </div>
            {/* Barre toujours visible, même à 0 % (jamais un bloc vide). */}
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary to-[#a7f3d0] transition-[width] duration-700"
                style={{ width: `${Math.round(Math.max(0.03, xp.level.progress) * 100)}%` }}
              />
            </div>
            <p className="mt-1.5 flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
              <span className="tabular-nums">
                {t("{a} / {b} XP → level {n}", { a: xp.level.intoLevel, b: xp.level.forNext, n: xp.level.level + 1 })}
              </span>
              <span className="tabular-nums text-primary">{t("+{n} today", { n: xp.todayXp })}</span>
            </p>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        </div>
      </button>

      {/* ══ e) Repas du jour — un seul bloc ══ */}
      <MealsBlock onAddFood={onAddFood} />

      {/* ══ g) Widgets secondaires ══ */}
      <section className="flex items-center gap-3 rounded-2xl border border-[#a7f3d0]/10 bg-accent p-3.5">
        <span className="text-xl">{motivation.emoji}</span>
        <p className="text-sm font-semibold text-accent-foreground">{t(motivation.text)}</p>
      </section>

      <section className="flex items-center justify-between gap-2 rounded-2xl border border-[#a7f3d0]/10 bg-card px-4 py-3 shadow-sm">
        <span className="text-xs font-semibold text-muted-foreground">
          {t("Net calories")}
          <span className="ml-1 font-normal">{t("(food − workout burn)")}</span>
        </span>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-sm font-extrabold tabular-nums">
            {Math.max(0, Math.round(totals.calories - burn)).toLocaleString()} kcal
            {burn > 0 && <span className="ml-1 text-xs font-bold text-primary">−{t("{n} burn", { n: burn })}</span>}
          </span>
          <ShareButton
            text={t("I've eaten {eaten} kcal today on Sahtek — {left} kcal left of my goal! 🥗🔥", {
              eaten,
              left: remaining,
            })}
          />
        </div>
      </section>

      <HealthSyncCard
        sensorAvailable={sensorAvailable}
        sensorPermission={sensorPermission}
        onEnable={enableSensor}
        onAddSteps={() => addSteps(1000)}
        onAddWorkout={() => addWorkout(15)}
      />

      {remaining > 0 && eaten > 0 && <SuggestionsCard remaining={remaining} />}

      <TipCard />

      <AdSlot slot={AD_SLOTS.homeBanner} format="banner" />
    </div>
  )
}

/* ---------- b) Dernier repas scanné ---------- */

type ScanEntry = { entryId: string; food: FoodItem; quantity: number; meal: MealKey; at: number }

function LastScanCard({
  scan,
  others,
  onOpenMeals,
}: {
  scan: ScanEntry
  others: ScanEntry[]
  onOpenMeals: () => void
}) {
  const t = useT()
  const mealName = useMealName()
  const kcal = Math.round(scan.food.calories * scan.quantity)
  return (
    <section className="animate-fade-in overflow-hidden rounded-3xl border border-[#a7f3d0]/12 bg-card shadow-sm">
      <div className="flex items-center justify-between px-4 pt-3.5">
        <h2 className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-muted-foreground">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-primary">
            <Camera className="h-3.5 w-3.5" />
          </span>
          {t("Last scanned meal")}
        </h2>
        <span className="text-[11px] font-semibold text-muted-foreground">
          {mealMeta[scan.meal].emoji} {mealName(scan.meal)}
          {scan.at ? ` · ${timeLabel(scan.at)}` : ""}
        </span>
      </div>

      <div className="mt-3 flex gap-3 px-4">
        {scan.food.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={scan.food.photo}
            alt={scan.food.name}
            className="h-24 w-24 shrink-0 rounded-2xl object-cover sm:h-28 sm:w-28"
          />
        ) : (
          <span className="flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl bg-muted text-4xl sm:h-28 sm:w-28">
            {scan.food.emoji}
          </span>
        )}
        <div className="flex min-w-0 flex-1 flex-col justify-center">
          <p className="truncate text-[15px] font-extrabold leading-tight" title={scan.food.name}>
            {scan.food.name}
            {scan.quantity > 1 ? ` ×${scan.quantity}` : ""}
          </p>
          <p className="mt-1 text-2xl font-black leading-none tabular-nums text-primary">
            {kcal} <span className="text-xs font-bold text-muted-foreground">kcal</span>
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-extrabold">
            <span className="rounded-md bg-protein-soft px-2 py-0.5 text-protein">
              P{Math.round(scan.food.protein * scan.quantity)}g
            </span>
            <span className="rounded-md bg-carbs-soft px-2 py-0.5 text-carbs">
              C{Math.round(scan.food.carbs * scan.quantity)}g
            </span>
            <span className="rounded-md bg-fat-soft px-2 py-0.5 text-fat">
              F{Math.round(scan.food.fat * scan.quantity)}g
            </span>
          </div>
        </div>
      </div>

      {others.length > 0 && (
        <div className="mt-3 flex gap-2 overflow-x-auto no-scrollbar px-4 pb-3">
          {others.map((s) => (
            <div
              key={s.entryId}
              className="flex w-28 shrink-0 items-center gap-2 rounded-xl border border-[#a7f3d0]/10 bg-muted/30 p-2"
              title={`${s.food.name} — ${Math.round(s.food.calories * s.quantity)} kcal`}
            >
              {s.food.photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.food.photo} alt="" className="h-9 w-9 shrink-0 rounded-lg object-cover" />
              ) : (
                <span className="text-lg">{s.food.emoji}</span>
              )}
              <div className="min-w-0">
                <p className="truncate text-[10px] font-bold">{s.food.name}</p>
                <p className="text-[10px] font-extrabold tabular-nums text-primary">
                  {Math.round(s.food.calories * s.quantity)} kcal
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={onOpenMeals}
        className="flex w-full items-center justify-between border-t border-border px-4 py-2.5 text-xs font-bold text-primary active:scale-[0.99]"
      >
        {t("See it in {meal}", { meal: mealName(scan.meal) })}
        <ChevronRight className="h-4 w-4" />
      </button>
    </section>
  )
}

/* ---------- e) Repas du jour : un seul bloc avec sélecteur ---------- */

function MealsBlock({ onAddFood }: { onAddFood: (meal?: MealKey) => void }) {
  const { state, removeEntry, setQuantity, moveEntry } = useFoodLog()
  const [active, setActive] = useState<MealKey>(() => {
    const h = new Date().getHours()
    return h < 11 ? "breakfast" : h < 16 ? "lunch" : h < 22 ? "dinner" : "snacks"
  })
  const [editing, setEditing] = useState<string | null>(null)

  const entries = state.meals[active]
  const macros = totalsFor(entries)
  const t = useT()
  const mealName = useMealName()
  const dayTotal = useMemo(() => dayTotals(state.meals), [state.meals])

  return (
    <section className="rounded-3xl border border-[#a7f3d0]/10 bg-card shadow-sm">
      <div className="flex items-center justify-between px-4 pt-4">
        <h2 className="text-base font-extrabold tracking-tight">{t("Today's meals")}</h2>
        <span className="text-[11px] font-bold tabular-nums text-muted-foreground">
          {t("{n} kcal total", { n: Math.round(dayTotal.calories).toLocaleString() })}
        </span>
      </div>

      {/* Sélecteur de repas — chaque tuile porte ses propres kcal */}
      <div className="grid grid-cols-4 gap-1.5 p-3">
        {mealOrder.map((key) => {
          const m = totalsFor(state.meals[key])
          const isActive = active === key
          return (
            <button
              key={key}
              type="button"
              onClick={() => {
                haptic("light")
                setActive(key)
                setEditing(null)
              }}
              aria-pressed={isActive}
              className={cn(
                "flex flex-col items-center gap-0.5 rounded-2xl border py-2 text-[10px] font-bold transition-all active:scale-95",
                isActive ? "border-primary bg-primary/15 text-foreground" : "border-border bg-muted/30 text-muted-foreground",
              )}
            >
              <span className="text-lg">{mealMeta[key].emoji}</span>
              <span className="truncate">{mealName(key)}</span>
              <span className={cn("tabular-nums", isActive ? "text-primary" : "text-muted-foreground/80")}>
                {Math.round(m.calories)} kcal
              </span>
            </button>
          )
        })}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-2.5">
        <p className="min-w-0 truncate text-xs text-muted-foreground">
          {entries.length === 0
            ? t("Nothing in {meal} yet", { meal: mealName(active) })
            : `P ${Math.round(macros.protein)}g · C ${Math.round(macros.carbs)}g · F ${Math.round(macros.fat)}g · ${entries.length === 1 ? t("1 item") : t("{n} items", { n: entries.length })}`}
        </p>
        <button
          type="button"
          onClick={() => onAddFood(active)}
          className="flex shrink-0 items-center gap-1 rounded-xl bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground active:scale-95"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={3} /> {t("Add")}
        </button>
      </div>

      {entries.length > 0 && (
        <div className="border-t border-border px-3 pb-2 pt-1">
          {entries.map((e) => (
            <EntryRow
              key={e.entryId}
              entryId={e.entryId}
              meal={active}
              food={e.food}
              quantity={e.quantity}
              loggedAt={e.loggedAt}
              editing={editing === e.entryId}
              onToggleEdit={() => setEditing(editing === e.entryId ? null : e.entryId)}
              onQuantity={(q) => setQuantity(active, e.entryId, q)}
              onMove={(to) => {
                moveEntry(active, e.entryId, to)
                setEditing(null)
                setActive(to)
              }}
              onDelete={() => {
                removeEntry(active, e.entryId)
                setEditing(null)
              }}
            />
          ))}
        </div>
      )}
    </section>
  )
}

/** Une ligne du journal : lecture rapide + édition (quantité, repas, suppression). */
function EntryRow({
  entryId,
  meal,
  food,
  quantity,
  loggedAt,
  editing,
  onToggleEdit,
  onQuantity,
  onMove,
  onDelete,
}: {
  entryId: string
  meal: MealKey
  food: FoodItem
  quantity: number
  loggedAt?: number
  editing: boolean
  onToggleEdit: () => void
  onQuantity: (q: number) => void
  onMove: (to: MealKey) => void
  onDelete: () => void
}) {
  const t = useT()
  const mealName = useMealName()
  return (
    <div className="rounded-2xl py-1.5">
      <button type="button" onClick={onToggleEdit} className="flex w-full items-center gap-3 text-left active:scale-[0.99]">
        {food.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={food.photo} alt="" className="h-11 w-11 shrink-0 rounded-xl object-cover" />
        ) : (
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted text-lg">
            {food.emoji}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">
            {food.name}
            {quantity > 1 ? ` ×${quantity}` : ""}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {food.serving} · {Math.round(food.calories * quantity)} kcal
            {loggedAt ? ` · ${timeLabel(loggedAt)}` : ""}
          </p>
        </div>
        <ChevronRight className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", editing && "rotate-90")} />
      </button>

      {editing && (
        <div className="mt-2 animate-fade-in rounded-2xl bg-muted/50 p-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{t("Portion")}</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onQuantity(Math.max(1, quantity - 1))}
                aria-label="Decrease portion"
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-card active:scale-90"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span className="w-6 text-center text-sm font-extrabold tabular-nums">{quantity}</span>
              <button
                type="button"
                onClick={() => onQuantity(Math.min(20, quantity + 1))}
                aria-label="Increase portion"
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-primary active:scale-90"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <p className="mt-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">{t("Move to")}</p>
          <div className="mt-1.5 grid grid-cols-4 gap-1.5">
            {mealOrder.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => onMove(k)}
                disabled={k === meal}
                aria-label={t("Move to {meal}", { meal: mealName(k) })}
                className={cn(
                  "flex flex-col items-center rounded-xl border py-1.5 text-[10px] font-bold active:scale-95 disabled:opacity-40",
                  k === meal ? "border-primary bg-primary/15 text-foreground" : "border-border bg-card text-muted-foreground",
                )}
              >
                <span className="text-base">{mealMeta[k].emoji}</span>
                {mealName(k)}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={onDelete}
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-destructive/15 py-2 text-xs font-bold text-destructive active:scale-[0.98]"
          >
            <Trash2 className="h-3.5 w-3.5" /> {t("Delete this food")}
          </button>
        </div>
      )}
    </div>
  )
}

/* ---------- Building blocks ---------- */

function QuickStat({
  icon,
  tone,
  label,
  value,
}: {
  icon: React.ReactNode
  tone: string
  label: string
  value: string
}) {
  // Sur iPhone SE (320 px) les 2 stats tiennent dans ~110 px chacune : on
  // resserre l'espacement et la typo pour que « 120 kcal » ne soit pas tronqué.
  return (
    <div className="flex items-center justify-center gap-1 rounded-2xl border border-[#a7f3d0]/8 bg-[#0b1712]/60 px-1.5 py-2 sm:justify-start sm:gap-1.5 sm:px-3">
      <span className={cn("shrink-0", tone)}>{icon}</span>
      <div className="min-w-0">
        <p className="text-[8px] font-semibold uppercase leading-tight tracking-normal text-muted-foreground sm:text-[10px] sm:tracking-wide">
          {label}
        </p>
        <p className="truncate text-[11px] font-extrabold leading-tight tabular-nums sm:text-xs">{value}</p>
      </div>
    </div>
  )
}

function MacroMini({ macroKey, value, target }: { macroKey: MacroKey; value: number; target: number }) {
  const t = useT()
  const meta = macroMeta[macroKey]
  const pct = Math.min((value / Math.max(target, 1)) * 100, 100)
  const done = value >= target
  return (
    <div className="rounded-2xl bg-muted/40 p-2.5 sm:p-3">
      <div className="flex items-center justify-between">
        <p className={cn("text-[10px] font-bold sm:text-xs", meta.text)}>{t(meta.label)}</p>
        {done && <Check className={cn("h-3 w-3 shrink-0 sm:h-3.5 sm:w-3.5", meta.text)} strokeWidth={3} />}
      </div>
      <p className="mt-1 text-sm font-extrabold tabular-nums leading-none sm:text-base">
        {value}
        <span className="text-[10px] font-semibold text-muted-foreground">/{target}g</span>
      </p>
      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted sm:mt-2">
        <div
          className={cn("h-full rounded-full transition-all duration-700", meta.color)}
          style={{ width: barWidth(pct) }}
        />
      </div>
    </div>
  )
}

function GoalRow({
  icon,
  iconBg,
  iconTone,
  label,
  value,
  progress,
  bar,
  right,
}: {
  icon: React.ReactNode
  iconBg: string
  iconTone: string
  label: string
  value: string
  progress: number
  bar: string
  right?: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-3">
      <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", iconBg, iconTone)}>
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-sm font-bold">{label}</p>
          <p className="shrink-0 text-xs font-bold tabular-nums text-muted-foreground">{value}</p>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className={cn("h-full rounded-full transition-all duration-500", bar)}
            style={{ width: barWidth(progress) }}
          />
        </div>
      </div>
      {right}
    </div>
  )
}

function HealthSyncCard({
  sensorAvailable,
  sensorPermission,
  onEnable,
  onAddSteps,
  onAddWorkout,
}: {
  sensorAvailable: boolean
  sensorPermission: string
  onEnable: () => Promise<void>
  onAddSteps: () => void
  onAddWorkout: () => void
}) {
  const t = useT()
  const [busy, setBusy] = useState(false)
  return (
    <section className="rounded-2xl border border-[#a7f3d0]/10 bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-steps-soft text-steps">
            <span aria-hidden>⌚</span>
          </span>
          <div className="min-w-0">
            <p className="text-sm font-extrabold">{t("Phone health sync")}</p>
            <p className="truncate text-xs text-muted-foreground">
              {sensorAvailable
                ? sensorPermission === "granted"
                  ? t("Motion sensors active — counting your steps 🚶")
                  : sensorPermission === "denied"
                    ? t("Motion access denied — add manually below")
                    : t("Count steps with your phone's motion sensors")
                : t("Desktop detected — add steps & workouts manually")}
            </p>
          </div>
        </div>
        {sensorAvailable && sensorPermission === "unknown" && (
          <button
            type="button"
            onClick={async () => {
              setBusy(true)
              await onEnable()
              setBusy(false)
            }}
            disabled={busy}
            className="shrink-0 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground active:scale-95"
          >
            {busy ? "…" : t("Enable")}
          </button>
        )}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onAddSteps}
          className="rounded-xl bg-muted py-2 text-xs font-bold active:scale-95"
        >
          {t("+ 1,000 steps")}
        </button>
        <button
          type="button"
          onClick={onAddWorkout}
          className="rounded-xl bg-muted py-2 text-xs font-bold active:scale-95"
        >
          {t("+ 15 min workout")}
        </button>
      </div>
    </section>
  )
}

/** Recipe ideas that fit what's left of the daily budget (Suggestion engine in lib/food-requests). */
function SuggestionsCard({ remaining }: { remaining: number }) {
  const suggestions = useMemo(() => suggestRecipes(remaining), [remaining])
  const { addFood } = useFoodLog()
  const [added, setAdded] = useState<string | null>(null)
  const t = useT()

  const quickAdd = (name: string, kcal: number, protein: number, carbs: number, fat: number, emoji: string) => {
    addFood(
      // right meal for the current hour
      new Date().getHours() < 11
        ? "breakfast"
        : new Date().getHours() < 16
          ? "lunch"
          : new Date().getHours() < 22
            ? "dinner"
            : "snacks",
      { id: `sugg_${name}`, name, serving: "1 portion", calories: kcal, protein, carbs, fat, emoji },
    )
    setAdded(name)
    window.setTimeout(() => setAdded(null), 1500)
  }

  return (
    <section className="animate-fade-in rounded-3xl border border-[#a7f3d0]/10 bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-base font-extrabold">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-primary">🍽️</span>
          {t("Fits your {n} kcal left", { n: remaining.toLocaleString() })}
        </h2>
      </div>
      <div className="flex snap-x gap-2 overflow-x-auto no-scrollbar pb-1 sm:grid sm:grid-cols-3 sm:gap-3 sm:overflow-visible">
        {suggestions.map((s) => (
          <div
            key={s.name}
            className="w-40 shrink-0 snap-start rounded-2xl border border-[#a7f3d0]/15 bg-muted/40 p-3 sm:w-auto"
          >
            <span className="text-2xl">{s.emoji}</span>
            <p className="mt-1 truncate text-sm font-bold">{s.name}</p>
            <p className="truncate text-[11px] text-muted-foreground">{s.detail}</p>
            <p className="mt-1 text-xs font-extrabold text-primary">
              {s.calories} kcal · P{s.protein}
            </p>
            <button
              type="button"
              onClick={() => quickAdd(s.name, s.calories, s.protein, s.carbs, s.fat, s.emoji)}
              className={cn(
                "mt-2 flex w-full items-center justify-center gap-1 rounded-xl py-1.5 text-xs font-bold transition-all active:scale-95",
                added === s.name ? "bg-primary/20 text-primary" : "bg-primary text-primary-foreground",
              )}
            >
              {added === s.name ? (
                <>
                  <Check className="h-3.5 w-3.5" strokeWidth={3} /> {t("Added!")}
                </>
              ) : (
                <>
                  <Plus className="h-3.5 w-3.5" strokeWidth={3} /> {t("Quick add")}
                </>
              )}
            </button>
          </div>
        ))}
      </div>
    </section>
  )
}

/** Native share (WhatsApp, Messages…) with clipboard fallback. */
function ShareButton({ text }: { text: string }) {
  const [done, setDone] = useState(false)
  const share = async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title: "Sahtek", text })
        return
      }
      await navigator.clipboard.writeText(text)
      setDone(true)
      window.setTimeout(() => setDone(false), 1500)
    } catch {
      // user cancelled — ignore
    }
  }
  return (
    <button
      type="button"
      onClick={() => void share()}
      aria-label="Share today's progress"
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-primary transition-transform active:scale-90"
    >
      {done ? <Check className="h-4 w-4" strokeWidth={3} /> : <Share2 className="h-4 w-4" />}
    </button>
  )
}

const TIPS = [
  { emoji: "💧", text: "Drink a glass of water before each meal — it helps with satiety." },
  { emoji: "🥗", text: "Fill half your plate with veggies at lunch and dinner." },
  { emoji: "🚶", text: "A 10-minute walk after eating helps stabilize blood sugar." },
  { emoji: "🥚", text: "Protein at breakfast keeps you full until lunch — try eggs or yogurt." },
  { emoji: "🌶️", text: "Harissa and spices add flavor without calories — use them freely!" },
  { emoji: "😴", text: "Poor sleep increases hunger hormones. Aim for 7-8 hours tonight." },
  { emoji: "🍽️", text: "Eat slowly: your brain needs ~20 minutes to register fullness." },
]

function TipCard() {
  const day = new Date().getDate() % TIPS.length
  const tip = TIPS[day]
  const t = useT()
  return (
    <section className="flex items-center gap-3 rounded-2xl border border-[#a7f3d0]/15 bg-card p-4 shadow-sm">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-xl">
        {tip.emoji}
      </span>
      <p className="text-sm font-medium text-muted-foreground">{t(tip.text)}</p>
    </section>
  )
}
