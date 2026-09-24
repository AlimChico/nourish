"use client"

import { useMemo, useState } from "react"
import { Flame, Clock, Zap, Dumbbell, RefreshCw, Check, Play, Sparkles, Timer } from "lucide-react"
import { BarChart } from "@/components/mini-charts"
import { useHealth } from "@/lib/health"
import {
  generateWorkout,
  muscleMeta,
  difficultyMeta,
  type MuscleKey,
  type Difficulty,
} from "@/lib/workout-generator"
import { useFoodLog } from "@/lib/food-log"
import { cn } from "@/lib/utils"

const MUSCLES: MuscleKey[] = ["chest", "back", "shoulders", "arms", "legs", "glutes", "core", "full"]
const DIFFICULTIES: Difficulty[] = ["beginner", "intermediate", "advanced"]

export function WorkoutScreen() {
  const { state, today: health, addWorkout, addSteps } = useHealth()
  const { addFood } = useFoodLog()

  // ---- real weekly chart from the health store (last 7 days)
  const chartData = useMemo(() => {
    const out: { day: string; value: number }[] = []
    const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const iso = d.toISOString().slice(0, 10)
      out.push({ day: names[d.getDay()], value: state.days[iso]?.workoutMinutes ?? 0 })
    }
    return out
  }, [state])
  const weekMin = chartData.reduce((s, d) => s + d.value, 0)
  const activeDays = chartData.filter((d) => d.value > 0).length

  // ---- generator state
  const [muscle, setMuscle] = useState<MuscleKey | null>(null)
  const [difficulty, setDifficulty] = useState<Difficulty>("intermediate")
  const [equipment, setEquipment] = useState(false)
  const [workout, setWorkout] = useState<ReturnType<typeof generateWorkout> | null>(null)
  const [doneBlocks, setDoneBlocks] = useState<Set<number>>(new Set())

  const generate = (m: MuscleKey) => {
    setMuscle(m)
    setWorkout(generateWorkout(m, difficulty, equipment))
    setDoneBlocks(new Set())
  }

  const toggleDone = (i: number) => {
    setDoneBlocks((s) => {
      const n = new Set(s)
      if (n.has(i)) n.delete(i)
      else n.add(i)
      return n
    })
  }

  const finishWorkout = () => {
    if (!workout) return
    const doneMin = Math.max(10, Math.round(workout.estimatedMin * (doneBlocks.size / Math.max(workout.blocks.length, 1))))
    addWorkout(doneMin)
    // “Burned” calories → subtract from today's dinner as a negative-ish entry is odd;
    // instead credit protein-free snack removal is complex — we simply log minutes
    // and give the user a visible calorie burn estimate.
    setWorkout({ ...workout, totalKcal: workout.totalKcal })
    setWorkout(null)
    setMuscle(null)
    setDoneBlocks(new Set())
  }

  const allDone = workout ? doneBlocks.size === workout.blocks.length : false

  return (
    <div className="aurora-glow mx-auto flex w-full flex-col gap-6 px-5 pb-8 pt-2 sm:px-6">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight">Workouts</h1>
        <p className="text-sm text-muted-foreground">Move more, feel stronger.</p>
      </header>

      {/* Summary — real data */}
      <section className="overflow-hidden rounded-3xl bg-secondary p-6 text-secondary-foreground">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-[#e6fff1]/60">This week</p>
            <p className="mt-1 text-4xl font-extrabold tabular-nums text-[#e6fff1]">
              {weekMin} <span className="text-lg font-bold text-[#e6fff1]/60">min</span>
            </p>
          </div>
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <Zap className="h-7 w-7" />
          </span>
        </div>
        <div className="mt-5 flex gap-3">
          <div className="flex-1 rounded-2xl bg-[#a7f3d0]/10 p-3">
            <p className="text-xs text-[#e6fff1]/60">Active days</p>
            <p className="text-xl font-extrabold text-[#e6fff1]">{activeDays} / 7</p>
          </div>
          <div className="flex-1 rounded-2xl bg-[#a7f3d0]/10 p-3">
            <p className="text-xs text-[#e6fff1]/60">Steps today</p>
            <p className="text-xl font-extrabold text-primary">{health.steps.toLocaleString()}</p>
          </div>
        </div>
      </section>

      {/* ---------------- Generator ---------------- */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-extrabold tracking-tight">Generate a workout</h2>
        </div>

        {/* Muscle picker */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
          {MUSCLES.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => generate(m)}
              className={cn(
                "flex flex-col items-center gap-1 rounded-2xl border p-3 text-center transition-all active:scale-95",
                muscle === m
                  ? "border-primary bg-primary/15"
                  : "border-[#a7f3d0]/10 bg-card hover:border-[#a7f3d0]/25",
              )}
            >
              <span className="text-2xl">{muscleMeta[m].emoji}</span>
              <span className="text-xs font-bold">{muscleMeta[m].label}</span>
            </button>
          ))}
        </div>

        {/* Options row */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="flex rounded-xl bg-card p-1">
            {DIFFICULTIES.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => {
                  setDifficulty(d)
                  if (muscle) setWorkout(generateWorkout(muscle, d, equipment))
                }}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-bold transition-colors",
                  difficulty === d ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                )}
              >
                {difficultyMeta[d].label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              setEquipment(!equipment)
              if (muscle) setWorkout(generateWorkout(muscle, difficulty, !equipment))
            }}
            className={cn(
              "flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition-colors",
              equipment ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground",
            )}
          >
            <Dumbbell className="h-3.5 w-3.5" />
            {equipment ? "Dumbbells available" : "No equipment"}
          </button>
        </div>

        {/* Generated session */}
        {workout && (
          <div className="mt-4 rounded-3xl bg-card p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-primary">
                  {muscleMeta[workout.muscle].label} · {difficultyMeta[workout.difficulty].label}
                </p>
                <h3 className="mt-0.5 text-xl font-extrabold">
                  {muscleMeta[workout.muscle].label} session
                </h3>
                <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> ~{workout.estimatedMin} min</span>
                  <span className="inline-flex items-center gap-1"><Flame className="h-3.5 w-3.5" /> ~{workout.totalKcal} kcal</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => muscle && generate(muscle)}
                aria-label="Regenerate workout"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted active:scale-90"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>

            {/* Warm-up */}
            <div className="mt-4 rounded-2xl bg-accent/40 p-3">
              <p className="text-xs font-extrabold uppercase tracking-wide text-primary">Warm-up · 3 min</p>
              <ul className="mt-1.5 space-y-0.5 text-sm text-muted-foreground">
                {workout.warmup.map((w) => (
                  <li key={w}>• {w}</li>
                ))}
              </ul>
            </div>

            {/* Exercise blocks */}
            <div className="mt-3 flex flex-col gap-2">
              {workout.blocks.map((b, i) => {
                const done = doneBlocks.has(i)
                return (
                  <button
                    key={b.exercise.name}
                    type="button"
                    onClick={() => toggleDone(i)}
                    className={cn(
                      "flex items-center gap-3 rounded-2xl border p-3 text-left transition-all active:scale-[0.99]",
                      done ? "border-primary/40 bg-primary/10" : "border-transparent bg-muted/40",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black",
                        done ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground",
                      )}
                    >
                      {done ? <Check className="h-4 w-4" strokeWidth={3} /> : i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className={cn("truncate text-sm font-bold", done && "line-through opacity-60")}>
                        {b.exercise.name}
                      </p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {b.sets} × {b.reps} · rest {difficultyMeta[workout.difficulty].restSec}s · {b.exercise.cue}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Cooldown */}
            <div className="mt-3 rounded-2xl bg-accent/40 p-3">
              <p className="text-xs font-extrabold uppercase tracking-wide text-primary">Cool-down</p>
              <p className="mt-1 text-sm text-muted-foreground">{workout.cooldown}</p>
            </div>

            {/* Finish */}
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setWorkout(null)
                  setMuscle(null)
                  setDoneBlocks(new Set())
                }}
                className="rounded-2xl bg-muted px-4 py-3 text-sm font-bold active:scale-[0.98]"
              >
                Discard
              </button>
              <button
                type="button"
                onClick={finishWorkout}
                disabled={!allDone}
                className={cn(
                  "flex flex-1 items-center justify-center gap-2 rounded-2xl py-3 text-sm font-extrabold transition-all",
                  allDone
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30 active:scale-[0.98]"
                    : "bg-muted text-muted-foreground",
                )}
              >
                <Play className="h-4 w-4" />
                {allDone ? `Log it — ${Math.max(10, workout.estimatedMin)} min ✓` : `Check off all ${workout.blocks.length} exercises`}
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Weekly chart — real minutes */}
      <section className="rounded-3xl bg-card p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-fat-soft text-fat">
            <Timer className="h-4 w-4" />
          </span>
          <h2 className="font-extrabold">Minutes per day (last 7 days)</h2>
        </div>
        <BarChart data={chartData} barClassName="bg-fat" />
      </section>

      {/* Today's quick log */}
      <section className="rounded-3xl bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-extrabold">Today</p>
            <p className="text-sm text-muted-foreground">
              {health.workoutMinutes} min logged · {health.steps.toLocaleString()} steps
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => addWorkout(15)}
              className="rounded-xl bg-muted px-3 py-2 text-xs font-bold active:scale-95"
            >
              + 15 min
            </button>
            <button
              type="button"
              onClick={() => addSteps(1000)}
              className="rounded-xl bg-muted px-3 py-2 text-xs font-bold active:scale-95"
            >
              + 1,000 steps
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
