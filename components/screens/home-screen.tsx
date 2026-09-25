"use client"

import { useMemo, useState } from "react"
import {
  ChevronDown,
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
} from "lucide-react"
import { AnimatedCounter } from "@/components/animated-counter"
import { ProgressRing } from "@/components/progress-ring"
import { OfflineBanner } from "@/components/offline-banner"
import { macroMeta, type MacroKey } from "@/lib/nutrition-data"
import { dayTotals, mealMeta, mealOrder, totalsFor, useFoodLog, type MealKey } from "@/lib/food-log"
import { suggestRecipes } from "@/lib/food-requests"
import { useAccount } from "@/lib/account"
import { useHealth } from "@/lib/health"
import { useStreak } from "@/components/use-streak"
import { AdSlot, AD_SLOTS } from "@/components/ad-slot"
import { cn } from "@/lib/utils"
import { haptic } from "@/lib/haptic"

const dayKeyOf = (d: Date) => d.toISOString().slice(0, 10)

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
}: {
  onAddFood: (meal?: MealKey) => void
  onOpenSettings: () => void
  onOpenCoach?: () => void
}) {
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
  const [open, setOpen] = useState<MealKey | null>(() => {
    // Lazily expand the meal matching the current time of day.
    const h = new Date().getHours()
    return h < 11 ? "breakfast" : h < 16 ? "lunch" : h < 22 ? "dinner" : null
  })

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
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening"
  const motivation = motivationFor({ eaten, target, remaining, hasLogged, hour })

  /** Current week (Mon → Sun), real data: history calories or today's live totals + steps. */
  const weekDays = useMemo(() => {
    const labels = ["M", "T", "W", "T", "F", "S", "S"]
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
  }, [state.date, state.history, state.meals, totals.calories, healthState.days])

  return (
    <div className="aurora-glow mx-auto flex w-full flex-col gap-4 px-4 pb-4 pt-2 sm:gap-5 sm:px-6 sm:pb-6">
      {/* Greeting */}
      <header className="flex items-center justify-between pt-1">
        <div className="min-w-0">
          <h1 className="truncate text-[clamp(1.25rem,4.5vw,1.75rem)] font-extrabold tracking-tight">
            {greeting}
            {firstName ? `, ${firstName}` : ""} 👋
          </h1>
          <p className="text-sm text-muted-foreground">Let&apos;s reach your goal today.</p>
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

      {/* Hors-ligne : tout est gardé en local, synchro au retour du réseau */}
      <OfflineBanner />

      {/* HERO — calories restantes : la carte principale, anneau de progression */}
      <section className="relative overflow-hidden rounded-[1.9rem] border border-[#a7f3d0]/12 bg-gradient-to-b from-[#11251b] to-[#0d1a13] p-5 shadow-[0_18px_44px_rgba(0,0,0,0.4)] sm:p-6">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:justify-center sm:gap-12 lg:gap-16">
          <ProgressRing
            value={eaten}
            max={Math.max(target, 1)}
            strokeWidth={13}
            className="w-48 shrink-0 sm:w-44 lg:w-52"
            trackClassName="text-[#a7f3d0]/10"
            progressClassName={isOver ? "text-destructive" : "text-calories"}
          >
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
              {isOver ? "Over budget" : "Remaining"}
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
              {eaten.toLocaleString()} / {target.toLocaleString()} eaten
            </p>
          </ProgressRing>

          {/* Quick stats — real numbers only, verticales à côté de l'anneau sur tablette */}
          <div className="grid w-full grid-cols-3 gap-2 sm:w-40 sm:shrink-0 sm:grid-cols-1 sm:gap-2.5">
            <QuickStat icon={<Flame className="h-3.5 w-3.5" />} tone="text-fat" label="Burn" value={`${burn} kcal`} />
            <QuickStat
              icon={<Footprints className="h-3.5 w-3.5" />}
              tone="text-steps"
              label="Steps"
              value={health.steps.toLocaleString()}
            />
            <QuickStat
              icon={<Droplets className="h-3.5 w-3.5" />}
              tone="text-water"
              label="Water"
              value={`${state.water}/${targets.water}`}
            />
          </div>
        </div>

        <p className="mt-4 text-center text-[11px] font-semibold text-muted-foreground sm:text-left">
          {isOver
            ? `${(eaten - target).toLocaleString()} kcal above your daily goal`
            : `${pct.toFixed(0)}% of today's ${target.toLocaleString()} kcal goal`}
        </p>
      </section>

      {/* Weekly streak tracker — real user data */}
      <StreakCard streak={streak} weekDays={weekDays} />

      {/* Macros — 3 mini cards compactes, plus larges sur tablette */}
      <section className="grid grid-cols-3 gap-2 sm:gap-3.5">
        {(Object.keys(macroMeta) as MacroKey[]).map((key) => (
          <MacroMini key={key} macroKey={key} value={Math.round(totals[key])} target={targets[key]} />
        ))}
      </section>

      {/* Add food CTA — le scan a son propre bouton flottant (FAB), toujours visible */}
      <button
        type="button"
        onClick={() => onAddFood()}
        className="flex items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 text-base font-bold text-primary-foreground shadow-lg shadow-primary/25 transition-transform active:scale-[0.98] sm:mx-auto sm:w-full sm:max-w-sm"
      >
        <Plus className="h-5 w-5" strokeWidth={2.5} />
        Add food
      </button>

      {/* Today's meals */}
      <section>
        <div className="mb-2.5 flex items-center justify-between">
          <h2 className="text-base font-extrabold tracking-tight">Today&apos;s meals</h2>
          <button type="button" className="text-sm font-semibold text-primary" onClick={() => onAddFood()}>
            See all
          </button>
        </div>
        <div className="flex flex-col gap-2.5 sm:grid sm:grid-cols-2 sm:items-start sm:gap-3">
          {mealOrder.map((key) => {
            const entries = state.meals[key]
            const t = totalsFor(entries)
            const empty = entries.length === 0
            const isOpen = open === key
            return (
              <div key={key} className="overflow-hidden rounded-2xl border border-[#a7f3d0]/10 bg-card shadow-sm">
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : key)}
                  className="flex w-full items-center gap-3 p-3.5 text-left transition-transform active:scale-[0.99]"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-xl">
                    {mealMeta[key].emoji}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-bold">{mealMeta[key].name}</p>
                      <p className="shrink-0 text-sm font-bold tabular-nums">{Math.round(t.calories)} kcal</p>
                    </div>
                    {empty ? (
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        Nothing logged yet — tap “+” to add
                      </p>
                    ) : (
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        P {Math.round(t.protein)}g · C {Math.round(t.carbs)}g · F {Math.round(t.fat)}g ·{" "}
                        {entries.length} item{entries.length > 1 ? "s" : ""}
                      </p>
                    )}
                  </div>
                  <span
                    role="button"
                    tabIndex={0}
                    aria-label={`Add to ${mealMeta[key].name}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      onAddFood(key)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.stopPropagation()
                        onAddFood(key)
                      }
                    }}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-primary transition-transform active:scale-90 sm:h-10 sm:w-10"
                  >
                    <Plus className="h-4 w-4 sm:h-5 sm:w-5" strokeWidth={2.5} />
                  </span>
                  {!empty && (
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                        isOpen && "rotate-180",
                      )}
                    />
                  )}
                </button>

                {isOpen && !empty && (
                  <div className="border-t border-border px-3.5 py-1.5">
                    {entries.map((e) => (
                      <div key={e.entryId} className="flex items-center gap-3 py-2">
                        <span className="text-lg">{e.food.emoji}</span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">
                            {e.food.name}
                            {e.quantity > 1 ? ` ×${e.quantity}` : ""}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {e.food.serving} · {Math.round(e.food.calories * e.quantity)} kcal
                          </p>
                        </div>
                        <DeleteEntryButton entryId={e.entryId} meal={key} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>

      {/* Today's goals — liste simple sur mobile, 2 colonnes équilibrées sur tablette */}
      <section className="rounded-3xl border border-[#a7f3d0]/10 bg-card p-4 shadow-sm sm:p-6">
        <h2 className="mb-3 text-base font-extrabold tracking-tight">Today&apos;s goals</h2>
        <div className="flex flex-col gap-3 sm:grid sm:grid-cols-2 sm:items-start sm:gap-x-8 sm:gap-y-4">
          <GoalRow
            icon={<Flame className="h-4 w-4" />}
            iconBg="bg-calories-soft"
            iconTone="text-calories"
            label="Calories"
            value={`${eaten.toLocaleString()} / ${target.toLocaleString()} kcal`}
            progress={pct}
            bar={isOver ? "bg-destructive" : "bg-calories"}
          />
          <GoalRow
            icon={<Beef className="h-4 w-4" />}
            iconBg="bg-protein-soft"
            iconTone="text-protein"
            label="Protein"
            value={`${Math.round(totals.protein)} / ${targets.protein} g`}
            progress={Math.min((totals.protein / Math.max(targets.protein, 1)) * 100, 100)}
            bar="bg-protein"
          />
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-water-soft text-water">
              <Droplets className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-sm font-bold">Water</p>
                <p className="shrink-0 text-xs font-bold tabular-nums text-muted-foreground">
                  {state.water} / {targets.water} glasses
                </p>
              </div>
              <div className="mt-1.5 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-water transition-all duration-500"
                    style={{ width: `${Math.min((state.water / Math.max(targets.water, 1)) * 100, 100)}%` }}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    haptic("light")
                    addWater(-1)
                  }}
                  aria-label="Remove a glass of water"
                  className="flex h-7 w-7 items-center justify-center rounded-md bg-muted text-foreground active:scale-90 sm:h-8 sm:w-8"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    haptic("success")
                    addWater(1)
                  }}
                  aria-label="Add a glass of water"
                  className="flex h-7 w-7 items-center justify-center rounded-md bg-water text-[#e6fff1] active:scale-95 sm:h-8 sm:w-8"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
          <GoalRow
            icon={<Dumbbell className="h-4 w-4" />}
            iconBg="bg-fat-soft"
            iconTone="text-fat"
            label="Workout"
            value={`${health.workoutMinutes} / 30 min`}
            progress={Math.min((health.workoutMinutes / 30) * 100, 100)}
            bar="bg-fat"
          />
        </div>
      </section>

      {/* Motivation — dynamic, based on today's real progress */}
      <section className="flex items-center gap-3 rounded-2xl border border-[#a7f3d0]/10 bg-accent p-3.5">
        <span className="text-xl">{motivation.emoji}</span>
        <p className="text-sm font-semibold text-accent-foreground">{motivation.text}</p>
      </section>

      {/* Net calories: eaten vs burned by workouts */}
      <section className="flex items-center justify-between gap-2 rounded-2xl border border-[#a7f3d0]/10 bg-card px-4 py-3 shadow-sm">
        <span className="text-xs font-semibold text-muted-foreground">
          Net calories
          <span className="ml-1 font-normal">(food − workout burn)</span>
        </span>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-sm font-extrabold tabular-nums">
            {Math.max(0, Math.round(totals.calories - burn)).toLocaleString()} kcal
            {burn > 0 && <span className="ml-1 text-xs font-bold text-primary">−{burn} burn</span>}
          </span>
          <ShareButton
            text={`I've eaten ${eaten} kcal today on Sahtek — ${remaining} kcal left of my goal! 🥗🔥`}
          />
        </div>
      </section>

      {/* Health sync */}
      <HealthSyncCard
        sensorAvailable={sensorAvailable}
        sensorPermission={sensorPermission}
        onEnable={enableSensor}
        onAddSteps={() => addSteps(1000)}
        onAddWorkout={() => addWorkout(15)}
      />

      {/* Recipe suggestions based on remaining calories */}
      {remaining > 0 && eaten > 0 && <SuggestionsCard remaining={remaining} />}

      {/* Tip of the day — rotates daily */}
      <TipCard />

      {/* Ad banner — bottom of the dashboard, right above the tab bar (never near the CTA or calorie card) */}
      <AdSlot slot={AD_SLOTS.homeBanner} format="banner" />
    </div>
  )
}

/* ---------- Streak ---------- */

type WeekDay = { label: string; key: string; isToday: boolean; isFuture: boolean; complete: boolean }

function StreakCard({ streak, weekDays }: { streak: number; weekDays: WeekDay[] }) {
  return (
    <section className="rounded-3xl border border-[#a7f3d0]/10 bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-base font-extrabold tracking-tight">
          <span aria-hidden>🔥</span>
          {streak} day streak
        </h2>
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">This week</span>
      </div>
      <div className="mt-3 flex items-start justify-between px-0.5">
        {weekDays.map((d) => (
          <div key={d.key} className="flex flex-col items-center gap-1.5" title={`${d.key}${d.complete ? " — done" : ""}`}>
            <span
              aria-hidden
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full transition-all sm:h-9 sm:w-9",
                // Jour futur : cercle pointillé vide
                d.isFuture && "border border-dashed border-border text-transparent",
                // Jour passé manqué : cercle vide discret
                !d.isFuture && !d.complete && !d.isToday && "border border-muted-foreground/30 bg-transparent text-transparent",
                // Jour réussi : rempli + coché
                d.complete && "bg-primary text-primary-foreground",
                // Aujourd'hui (non complété) : contour vert + halo, couleur distincte
                !d.isFuture && !d.complete && d.isToday &&
                  "border-2 border-primary bg-primary/10 text-primary shadow-[0_0_14px_rgba(52,211,153,0.35)]",
                // Aujourd'hui complété : coché + double mise en avant
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
    </section>
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
  return (
    <div className="flex items-center justify-center gap-1.5 rounded-2xl border border-[#a7f3d0]/8 bg-[#0b1712]/60 px-2 py-2 sm:justify-start sm:px-3">
      <span className={cn("shrink-0", tone)}>{icon}</span>
      <div className="min-w-0">
        <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground sm:text-[10px]">{label}</p>
        <p className="truncate text-xs font-extrabold tabular-nums">{value}</p>
      </div>
    </div>
  )
}

function MacroMini({ macroKey, value, target }: { macroKey: MacroKey; value: number; target: number }) {
  const meta = macroMeta[macroKey]
  const pct = Math.min((value / Math.max(target, 1)) * 100, 100)
  const done = value >= target
  return (
    <div className="rounded-2xl border border-[#a7f3d0]/10 bg-card p-2.5 shadow-sm sm:p-4">
      <div className="flex items-center justify-between">
        <p className={cn("text-[10px] font-bold sm:text-xs", meta.text)}>{meta.label}</p>
        {done && <Check className={cn("h-3 w-3 shrink-0 sm:h-3.5 sm:w-3.5", meta.text)} strokeWidth={3} />}
      </div>
      <p className="mt-1 text-sm font-extrabold tabular-nums leading-none sm:text-base">
        {value}
        <span className="text-[10px] font-semibold text-muted-foreground">/{target}g</span>
      </p>
      {/* Mini barre de progression individuelle */}
      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted sm:mt-2">
        <div className={cn("h-full rounded-full transition-all duration-700", meta.color)} style={{ width: `${pct}%` }} />
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
}: {
  icon: React.ReactNode
  iconBg: string
  iconTone: string
  label: string
  value: string
  progress: number
  bar: string
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
          <div className={cn("h-full rounded-full transition-all duration-500", bar)} style={{ width: `${progress}%` }} />
        </div>
      </div>
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
  const [busy, setBusy] = useState(false)
  return (
    <section className="rounded-2xl border border-[#a7f3d0]/10 bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-steps-soft text-steps">
            <span aria-hidden>⌚</span>
          </span>
          <div className="min-w-0">
            <p className="text-sm font-extrabold">Phone health sync</p>
            <p className="truncate text-xs text-muted-foreground">
              {sensorAvailable
                ? sensorPermission === "granted"
                  ? "Motion sensors active — counting your steps 🚶"
                  : sensorPermission === "denied"
                    ? "Motion access denied — add manually below"
                    : "Count steps with your phone's motion sensors"
                : "Desktop detected — add steps & workouts manually"}
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
            {busy ? "…" : "Enable"}
          </button>
        )}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onAddSteps}
          className="rounded-xl bg-muted py-2 text-xs font-bold active:scale-95"
        >
          + 1,000 steps
        </button>
        <button
          type="button"
          onClick={onAddWorkout}
          className="rounded-xl bg-muted py-2 text-xs font-bold active:scale-95"
        >
          + 15 min workout
        </button>
      </div>
    </section>
  )
}

function DeleteEntryButton({ meal, entryId }: { meal: MealKey; entryId: string }) {
  const { removeEntry } = useFoodLog()
  return (
    <button
      type="button"
      onClick={() => removeEntry(meal, entryId)}
      aria-label="Remove entry"
      className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground active:scale-90 sm:h-9 sm:w-9"
    >
      <Trash2 className="h-4 w-4" />
    </button>
  )
}

/** Recipe ideas that fit what's left of the daily budget (Suggestion engine in lib/food-requests). */
function SuggestionsCard({ remaining }: { remaining: number }) {
  const suggestions = useMemo(() => suggestRecipes(remaining), [remaining])
  const { addFood } = useFoodLog()
  const [added, setAdded] = useState<string | null>(null)

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
          Fits your {remaining.toLocaleString()} kcal left
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
                  <Check className="h-3.5 w-3.5" strokeWidth={3} /> Added!
                </>
              ) : (
                <>
                  <Plus className="h-3.5 w-3.5" strokeWidth={3} /> Quick add
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
  return (
    <section className="flex items-center gap-3 rounded-2xl border border-[#a7f3d0]/15 bg-card p-4 shadow-sm">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-xl">
        {tip.emoji}
      </span>
      <p className="text-sm font-medium text-muted-foreground">{tip.text}</p>
    </section>
  )
}
