"use client"

import { useMemo, useState } from "react"
import { Camera, ChevronDown, Minus, Plus, Trash2 } from "lucide-react"
import { ProgressRing } from "@/components/progress-ring"
import { AnimatedCounter } from "@/components/animated-counter"
import { dailyTargets, macroMeta, type MacroKey } from "@/lib/nutrition-data"
import { dayTotals, mealMeta, mealOrder, totalsFor, useFoodLog, type MealKey } from "@/lib/food-log"
import { useAccount } from "@/lib/account"
import { useHealth } from "@/lib/health"
import { useStreak } from "@/components/use-streak"
import { cn } from "@/lib/utils"

export function HomeScreen({
  onAddFood,
  onOpenScan,
}: {
  onAddFood: (meal?: MealKey) => void
  onOpenScan: () => void
}) {
  const { state, addWater } = useFoodLog()
  const { state: account, targets } = useAccount()
  const { today: health, sensorAvailable, sensorPermission, enableSensor, addSteps, addWorkout } = useHealth()
  const streak = useStreak()
  const [open, setOpen] = useState<MealKey | null>(null)

  const totals = useMemo(() => dayTotals(state.meals), [state.meals])
  const remaining = Math.max(targets.calories - totals.calories, 0)
  const firstName = account.name.trim().split(/\s+/)[0] ?? ""

  return (
    <div className="aurora-glow flex flex-col gap-6 px-5 pb-8 pt-2">
      {/* Greeting */}
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">
            Good morning{firstName ? `, ${firstName}` : ""} 👋
          </h1>
          <p className="text-sm text-muted-foreground">Let&apos;s reach your goal today.</p>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-secondary text-sm font-bold text-primary-foreground">
          AM
        </div>
      </header>

      {/* Calorie ring card */}
      <section className="rounded-3xl bg-card p-6 shadow-sm">
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
      <div className="grid grid-cols-[1fr_auto] gap-3">
        <button
          type="button"
          onClick={() => onAddFood()}
          className="flex items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-base font-bold text-primary-foreground shadow-lg shadow-primary/30 transition-transform active:scale-[0.98]"
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

      {/* Streak banner */}
      <StreakBanner streak={streak} hasLoggedToday={Object.values(state.meals).some((m) => m.length > 0)} />

      {/* Quick trackers */}
      <section className="grid grid-cols-3 gap-3">
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

      {/* Encouragement */}
      <section className="flex items-center gap-3 rounded-2xl bg-accent p-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          🎉
        </span>
        <p className="text-sm font-medium text-accent-foreground">
          You&apos;re on a <span className="font-extrabold">5-day streak</span>. Keep it going by logging dinner!
        </p>
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
