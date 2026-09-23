"use client"

import { useMemo, useState } from "react"
import { Camera, ChevronDown, Minus, Plus, Trash2, Share2, Check } from "lucide-react"
import { ProgressRing } from "@/components/progress-ring"
import { AnimatedCounter } from "@/components/animated-counter"
import { dailyTargets, macroMeta, type MacroKey } from "@/lib/nutrition-data"
import { dayTotals, mealMeta, mealOrder, totalsFor, useFoodLog, type MealKey } from "@/lib/food-log"
import { suggestRecipes } from "@/lib/food-requests"
import { useAccount } from "@/lib/account"
import { useHealth } from "@/lib/health"
import { useStreak } from "@/components/use-streak"
import { cn } from "@/lib/utils"

export function HomeScreen({
  onAddFood,
  onOpenScan,
  onOpenSettings,
}: {
  onAddFood: (meal?: MealKey) => void
  onOpenScan: () => void
  onOpenSettings: () => void
}) {
  const { state, addWater } = useFoodLog()
  const { state: account, targets } = useAccount()
  const { today: health, sensorAvailable, sensorPermission, enableSensor, addSteps, addWorkout } = useHealth()
  const streak = useStreak()
  const [open, setOpen] = useState<MealKey | null>(null)

  const totals = useMemo(() => dayTotals(state.meals), [state.meals])
  const remaining = Math.max(targets.calories - totals.calories, 0)
  const firstName = account.name.trim().split(/\s+/)[0] ?? ""
  const hour = new Date().getHours()
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening"

  return (
    <div className="aurora-glow mx-auto flex w-full max-w-2xl flex-col gap-6 px-5 pb-8 pt-2">
      {/* Greeting */}
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">
            {greeting}{firstName ? `, ${firstName}` : ""} 👋
          </h1>
          <p className="text-sm text-muted-foreground">Let&apos;s reach your goal today.</p>
        </div>
        <button
          type="button"
          onClick={onOpenSettings}
          aria-label="Open settings"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-secondary text-sm font-bold text-primary-foreground transition-transform active:scale-90"
        >
          {firstName ? firstName.slice(0, 2).toUpperCase() : "SA"}
        </button>
      </header>

      {/* Calorie ring card */}
      <section className="rounded-3xl bg-card p-6 shadow-sm">
        {/* Week strip — 7 dots for this week's adherence (MyFitnessPal-style) */}
        <WeekStrip history={state.history} todayCalories={totals.calories} target={targets.calories} />
        <div className="flex items-center justify-center">
          <ProgressRing value={totals.calories} max={targets.calories} size={210} strokeWidth={18}>
            <span className="text-4xl font-extrabold tabular-nums">
              <AnimatedCounter value={totals.calories} />
            </span>
            <span className="text-sm font-medium text-muted-foreground">
              / {targets.calories.toLocaleString()} kcal
            </span>
            <span className="mt-2 flex items-center gap-1 rounded-full bg-accent px-3 py-1 text-xs font-bold text-primary">
              🔥 {remaining.toLocaleString()} left
            </span>
          </ProgressRing>
        </div>

        {/* Macro bars */}
        <div className="mt-6 grid grid-cols-3 gap-3">
          {(Object.keys(macroMeta) as MacroKey[]).map((key) => (
            <MacroStat key={key} macroKey={key} value={Math.round(totals[key])} target={targets[key]} />
          ))}
        </div>
      </section>

      {/* Add food + scan */}
      <div className="grid grid-cols-[1fr_auto] gap-3 md:grid-cols-2 md:px-16">
        <button
          type="button"
          onClick={() => onAddFood()}
          className="flex items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-base font-bold text-primary-foreground shadow-lg shadow-primary/30 transition-transform active:scale-[0.98] md:col-start-1 md:col-end-2"
        >
          <Plus className="h-5 w-5" strokeWidth={2.5} />
          Add food
        </button>
        <button
          type="button"
          onClick={onOpenScan}
          aria-label="Scan a meal"
          className="flex items-center justify-center gap-2 rounded-2xl bg-secondary px-5 py-4 text-base font-bold text-secondary-foreground shadow-lg transition-transform active:scale-[0.98]"
        >
          <Camera className="h-5 w-5 text-primary" />
          Scan
        </button>
      </div>

      {/* Net calories: eaten vs burned by workouts */}
      <section className="flex items-center justify-between rounded-2xl bg-card px-4 py-3 shadow-sm">
        <span className="text-sm font-semibold text-muted-foreground">Net calories (food − workout burn)</span>
        <div className="flex items-center gap-2">
          <span className="text-sm font-extrabold tabular-nums">
            {Math.max(0, Math.round(totals.calories - health.workoutMinutes * 8)).toLocaleString()} kcal
            {health.workoutMinutes > 0 && (
              <span className="ml-1 text-xs font-bold text-primary">−{health.workoutMinutes * 8} burn</span>
            )}
          </span>
          <ShareButton
            text={`I've eaten ${Math.round(totals.calories)} kcal today on Sahtek — ${remaining} kcal left of my goal! 🥗🔥`}
          />
        </div>
      </section>

      {/* Streak banner */}
      <StreakBanner streak={streak} hasLoggedToday={Object.values(state.meals).some((m) => m.length > 0)} />

      {/* Quick trackers — 3-up phone, wide row tablet */}
      <section className="grid grid-cols-3 gap-3 md:gap-4">
        <TrackerCard
          icon="👣"
          label="Steps"
          value={health.steps.toLocaleString()}
          sub={`/${account.stepGoal.toLocaleString()}`}
          tone="steps"
          progress={health.steps / Math.max(account.stepGoal, 1)}
        />
        <TrackerCard
          icon="💪"
          label="Workout"
          value={`${health.workoutMinutes}`}
          sub="min today"
          tone="fat"
          progress={Math.min(health.workoutMinutes / 30, 1)}
        />
        <WaterCard water={state.water} goal={targets.water} onDelta={addWater} />
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
      {remaining > 0 && totals.calories > 0 && <SuggestionsCard remaining={remaining} />}

      {/* Tip of the day — rotates daily */}
      <TipCard />

      {/* Meals */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-extrabold tracking-tight">Today&apos;s meals</h2>
          <button type="button" className="text-sm font-semibold text-primary" onClick={() => onAddFood()}>
            See all
          </button>
        </div>
        <div className="flex flex-col gap-3">
          {mealOrder.map((key) => {
            const entries = state.meals[key]
            const t = totalsFor(entries)
            const empty = entries.length === 0
            const isOpen = open === key
            return (
              <div key={key} className="overflow-hidden rounded-2xl bg-card shadow-sm">
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : key)}
                  className="flex w-full items-center gap-4 p-4 text-left transition-transform active:scale-[0.99]"
                >
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-muted text-2xl">
                    {mealMeta[key].emoji}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <p className="font-bold">{mealMeta[key].name}</p>
                      <p className="text-sm font-bold tabular-nums">{Math.round(t.calories)} kcal</p>
                    </div>
                    {empty ? (
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        Tap to add {mealMeta[key].name.toLowerCase()}
                      </p>
                    ) : (
                      <p className="mt-0.5 truncate text-sm text-muted-foreground">
                        P {Math.round(t.protein)}g · C {Math.round(t.carbs)}g · F {Math.round(t.fat)}g ·{" "}
                        {entries.length} item{entries.length > 1 ? "s" : ""}
                      </p>
                    )}
                  </div>
                  {empty ? (
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
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-primary"
                    >
                      <Plus className="h-4 w-4" strokeWidth={2.5} />
                    </span>
                  ) : (
                    <ChevronDown
                      className={cn("h-5 w-5 shrink-0 text-muted-foreground transition-transform", isOpen && "rotate-180")}
                    />
                  )}
                </button>

                {isOpen && !empty && (
                  <div className="border-t border-border px-4 py-2">
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

    </div>
  )
}

function StreakBanner({ streak, hasLoggedToday }: { streak: number; hasLoggedToday: boolean }) {
  if (streak === 0) {
    return (
      <section className="flex items-center gap-3 rounded-2xl bg-accent p-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-xl text-primary-foreground">
          🔥
        </span>
        <p className="text-sm font-medium text-accent-foreground">
          Log your first meal today to start a <span className="font-extrabold">streak</span>!
        </p>
      </section>
    )
  }
  return (
    <section className="flex items-center gap-3 rounded-2xl bg-accent p-4">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-xl text-primary-foreground">
        🔥
      </span>
      <p className="text-sm font-medium text-accent-foreground">
        You&apos;re on a <span className="font-extrabold">{streak}-day streak</span>.
        {hasLoggedToday ? " Today is locked in — nice!" : " Log a meal to keep it alive!"}
      </p>
    </section>
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
    <section className="rounded-2xl bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-steps-soft text-steps">
            <WatchIcon />
          </span>
          <div>
            <p className="text-sm font-extrabold">Phone health sync</p>
            <p className="text-xs text-muted-foreground">
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
            className="rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground active:scale-95"
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

function WatchIcon() {
  return <span aria-hidden>⌚</span>
}

function DeleteEntryButton({ meal, entryId }: { meal: MealKey; entryId: string }) {
  const { removeEntry } = useFoodLog()
  return (
    <button
      type="button"
      onClick={() => removeEntry(meal, entryId)}
      aria-label="Remove entry"
      className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground active:scale-90"
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
      new Date().getHours() < 11 ? "breakfast" : new Date().getHours() < 16 ? "lunch" : new Date().getHours() < 22 ? "dinner" : "snacks",
      { id: `sugg_${name}`, name, serving: "1 portion", calories: kcal, protein, carbs, fat, emoji },
    )
    setAdded(name)
    window.setTimeout(() => setAdded(null), 1500)
  }

  return (
    <section className="animate-fade-in rounded-3xl bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-extrabold">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-primary">🍽️</span>
          Fits your {remaining.toLocaleString()} kcal left
        </h2>
      </div>
      <div className="flex snap-x gap-2 overflow-x-auto no-scrollbar pb-1">
        {suggestions.map((s) => (
          <div
            key={s.name}
            className="w-40 shrink-0 snap-start rounded-2xl border border-[#a7f3d0]/15 bg-muted/40 p-3"
          >
            <span className="text-2xl">{s.emoji}</span>
            <p className="mt-1 truncate text-sm font-bold">{s.name}</p>
            <p className="truncate text-[11px] text-muted-foreground">{s.detail}</p>
            <p className="mt-1 text-xs font-extrabold text-primary">{s.calories} kcal · P{s.protein}</p>
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
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-xl">{tip.emoji}</span>
      <p className="text-sm font-medium text-muted-foreground">{tip.text}</p>
    </section>
  )
}

function WeekStrip({
  history,
  todayCalories,
  target,
}: {
  history: { date: string; calories: number }[]
  todayCalories: number
  target: number
}) {
  const names = ["S", "M", "T", "W", "T", "F", "S"]
  const days: { label: string; logged: boolean; inRange: boolean; isToday: boolean }[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const iso = d.toISOString().slice(0, 10)
    const cals = iso === state_dateKey() ? todayCalories : history.find((h) => h.date === iso)?.calories ?? 0
    const logged = cals > 0
    const inRange = logged && cals <= target * 1.05
    days.push({
      label: names[d.getDay()],
      logged,
      inRange,
      isToday: i === 0,
    })
  }
  return (
    <div className="mb-5 flex items-center justify-between">
      {days.map((d, i) => (
        <div key={i} className="flex flex-col items-center gap-1">
          <span
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-black",
              d.isToday ? "ring-2 ring-primary ring-offset-2 ring-offset-card" : "",
              !d.logged
                ? "bg-muted text-muted-foreground"
                : d.inRange
                  ? "bg-primary text-primary-foreground"
                  : "bg-fat text-[#e6fff1]",
            )}
            title={d.logged ? "Logged" : "Not logged"}
          >
            {d.logged ? (d.inRange ? "✓" : "•") : ""}
          </span>
          <span className={cn("text-[10px] font-bold", d.isToday ? "text-primary" : "text-muted-foreground")}>
            {d.label}
          </span>
        </div>
      ))}
    </div>
  )
}

function state_dateKey(): string {
  return new Date().toISOString().slice(0, 10)
}

function MacroStat({ macroKey, value, target }: { macroKey: MacroKey; value: number; target: number }) {
  const meta = macroMeta[macroKey]
  const pct = Math.min((value / target) * 100, 100)
  return (
    <div className="rounded-2xl bg-muted/60 p-3 text-center">
      <p className={cn("text-xs font-bold", meta.text)}>{meta.label}</p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border">
        <div className={cn("h-full rounded-full transition-all duration-700", meta.color)} style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-2 text-sm font-bold tabular-nums">
        {value}
        <span className="text-xs font-medium text-muted-foreground">/{target}g</span>
      </p>
    </div>
  )
}

function TrackerCard({
  icon,
  label,
  value,
  sub,
  tone,
  progress,
}: {
  icon: string
  label: string
  value: string
  sub: string
  tone: "steps" | "fat" | "water"
  progress: number
}) {
  const toneMap = {
    steps: { text: "text-steps", bg: "bg-steps-soft", bar: "bg-steps" },
    fat: { text: "text-fat", bg: "bg-fat-soft", bar: "bg-fat" },
    water: { text: "text-water", bg: "bg-water-soft", bar: "bg-water" },
  }[tone]
  return (
    <div className="flex flex-col rounded-2xl bg-card p-3 shadow-sm">
      <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg", toneMap.bg, toneMap.text)}>{icon}</span>
      <p className="mt-2 text-lg font-extrabold leading-none tabular-nums">{value}</p>
      <p className="text-[11px] text-muted-foreground">{sub}</p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full", toneMap.bar)} style={{ width: `${Math.min(progress * 100, 100)}%` }} />
      </div>
      <span className="sr-only">{label}</span>
    </div>
  )
}

function WaterCard({ water, goal, onDelta }: { water: number; goal: number; onDelta: (delta: number) => void }) {
  return (
    <div className="flex flex-col rounded-2xl bg-card p-3 shadow-sm">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-water-soft text-water">💧</span>
      <p className="mt-2 text-lg font-extrabold leading-none tabular-nums">
        {water}
        <span className="text-[11px] font-medium text-muted-foreground">/{goal}</span>
      </p>
      <p className="text-[11px] text-muted-foreground">glasses</p>
      <div className="mt-2 flex items-center gap-1">
        <button
          type="button"
          onClick={() => onDelta(-1)}
          aria-label="Remove a glass of water"
          className="flex h-6 w-6 items-center justify-center rounded-md bg-muted text-foreground active:scale-90"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => onDelta(1)}
          aria-label="Add a glass of water"
          className="flex h-6 flex-1 items-center justify-center rounded-md bg-water text-[#e6fff1] active:scale-95"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}
