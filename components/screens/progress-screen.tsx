"use client"

import { useMemo, useState } from "react"
import { Flame, Award, Target, CalendarDays, Droplets, Scale, Clock3, Check, TrendingDown, TrendingUp } from "lucide-react"
import { BarChart, LineChart } from "@/components/mini-charts"
import { dayTotals, useFoodLog, type DayHistory, type MealKey } from "@/lib/food-log"
import { mealMeta } from "@/lib/food-log"
import { useAccount } from "@/lib/account"
import { useHealth } from "@/lib/health"
import { useWeight } from "@/lib/weight"
import { useStreak } from "@/components/use-streak"
import { AdSlot, AD_SLOTS } from "@/components/ad-slot"
import { cn } from "@/lib/utils"
import { haptic } from "@/lib/haptic"

const ranges = ["7 days", "30 days", "90 days"] as const
type RangeKey = (typeof ranges)[number]

function dayLabel(iso: string): string {
  const d = new Date(`${iso}T12:00:00`)
  return d.toLocaleDateString("en-US", { weekday: "short" })
}

function shiftDate(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00`)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

export function ProgressScreen() {
  const { state, history } = useFoodLog()
  const { state: account, targets } = useAccount()
  const { state: health } = useHealth()
  const weight = useWeight()
  const streak = useStreak()
  const [range, setRange] = useState<RangeKey>("7 days")
  const [weightInput, setWeightInput] = useState("")
  const [weightSaved, setWeightSaved] = useState(false)

  const n = range === "7 days" ? 7 : range === "30 days" ? 30 : 90

  const todayLive = useMemo(
    () => ({
      date: state.date,
      calories: Math.round(dayTotals(state.meals).calories),
      protein: Math.round(dayTotals(state.meals).protein),
      carbs: Math.round(dayTotals(state.meals).carbs),
      fat: Math.round(dayTotals(state.meals).fat),
      water: state.water,
    }),
    [state],
  )

  const byDate = useMemo(() => {
    const map = new Map<string, DayHistory>()
    for (const h of history) map.set(h.date, h)
    return map
  }, [history])

  const days = useMemo(() => {
    const out: { date: string; label: string; calories: number; water: number; steps: number; isToday: boolean }[] = []
    for (let i = n - 1; i >= 0; i--) {
      const date = shiftDate(todayLive.date, -i)
      const isToday = date === todayLive.date
      const h = isToday ? todayLive : byDate.get(date)
      out.push({
        date,
        label: isToday ? "Today" : dayLabel(date),
        calories: h?.calories ?? 0,
        water: h?.water ?? 0,
        steps: health.days[date]?.steps ?? 0,
        isToday,
      })
    }
    return out
  }, [n, todayLive, byDate, health.days])

  const chartData = useMemo(
    () =>
      days.map((d, i) => ({
        // label every bar on 7d, every 5th on 30d, every 15th on 90d
        day: n === 7 || i % (n / 6) === n / 6 - 1 ? d.date.slice(8) : "",
        value: d.calories,
        target: targets.calories,
      })),
    [days, n, targets.calories],
  )

  const logged = days.filter((d) => d.calories > 0)
  const avgCals = logged.length > 0 ? Math.round(logged.reduce((s, d) => s + d.calories, 0) / logged.length) : 0

  const goalHit = useMemo(() => {
    if (logged.length === 0) return null
    const onTarget = logged.filter((d) => d.calories <= targets.calories * 1.05).length
    return Math.round((onTarget / logged.length) * 100)
  }, [logged, targets.calories])

  const totalWater = days.reduce((s, d) => s + d.water, 0)
  const avgWater = Math.round((totalWater / n) * 10) / 10

  // ---- Weight ---------------------------------------------------------------
  const weightSeries = useMemo(() => [...weight.entries].reverse(), [weight.entries]) // oldest first
  const weightChart = useMemo(
    () =>
      weightSeries.slice(-14).map((e) => ({
        label: e.date.slice(5),
        value: e.kg,
      })),
    [weightSeries],
  )
  const firstWeight = weightSeries[0]?.kg ?? null
  const latestWeight = weight.latest?.kg ?? account.weight
  const startDelta = firstWeight !== null ? Math.round((latestWeight - firstWeight) * 10) / 10 : null
  const goalDelta = Math.round((latestWeight - account.targetWeight) * 10) / 10

  const saveWeight = () => {
    const v = Number(weightInput.replace(",", "."))
    if (!isFinite(v) || v < 25 || v > 400) return
    weight.addWeight(v)
    setWeightInput("")
    setWeightSaved(true)
    window.setTimeout(() => setWeightSaved(false), 2000)
  }

  // ---- Goal vs actual -------------------------------------------------------
  const actualTotal = days.reduce((s, d) => s + d.calories, 0)
  const targetTotal = targets.calories * n
  const ratio = targetTotal > 0 ? actualTotal / targetTotal : 0

  // ---- Today's meal timeline ------------------------------------------------
  const timeline = useMemo(() => {
    const items: { at: number; meal: MealKey; name: string; kcal: number; emoji: string; quantity: number }[] = []
    for (const key of Object.keys(mealMeta) as MealKey[]) {
      for (const e of state.meals[key]) {
        items.push({
          at: typeof e.loggedAt === "number" ? e.loggedAt : 0,
          meal: key,
          name: e.food.name,
          kcal: Math.round(e.food.calories * e.quantity),
          emoji: e.food.emoji,
          quantity: e.quantity,
        })
      }
    }
    items.sort((a, b) => b.at - a.at)
    return items
  }, [state.meals])

  return (
    <div className="aurora-glow mx-auto flex w-full flex-col gap-6 px-5 pb-8 pt-2 sm:grid sm:grid-cols-2 sm:items-start sm:px-6">
      <header className="flex items-center justify-between sm:col-span-2">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Progress</h1>
          <p className="text-sm text-muted-foreground">
            {history.length > 0
              ? `${history.length + 1} days tracked — every day is saved.`
              : "Your first day is being tracked."}
          </p>
        </div>
      </header>

      {/* Range switch */}
      <div className="flex gap-1 rounded-2xl bg-muted p-1 sm:col-span-2">
        {ranges.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRange(r)}
            className={cn(
              "flex-1 rounded-xl py-2 text-sm font-bold transition-all",
              range === r ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
            )}
          >
            {r}
          </button>
        ))}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:col-span-2 sm:grid-cols-4 sm:gap-4">
        <StatCard icon={Flame} tone="carbs" label="Avg intake" value={avgCals > 0 ? `${avgCals}` : "—"} sub="kcal / logged day" />
        <StatCard icon={Award} tone="fat" label="Streak" value={`${streak} day${streak === 1 ? "" : "s"}`} sub={streak > 0 ? "keep going!" : "log today!"} />
        <StatCard icon={Target} tone="protein" label="Goal hit" value={goalHit !== null ? `${goalHit}%` : "—"} sub="of days on target" />
        <StatCard icon={Droplets} tone="water" label="Water" value={`${avgWater}`} sub={`glasses / day · ${range}`} />
      </div>

      {/* Weight tracking */}
      <section className="rounded-3xl bg-card p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-fat-soft text-fat">
              <Scale className="h-4 w-4" />
            </span>
            <h2 className="font-extrabold">Weight</h2>
          </div>
          <span className="rounded-full bg-accent px-2.5 py-1 text-xs font-bold text-primary">
            {latestWeight} kg
          </span>
        </div>

        {weightChart.length >= 2 ? (
          <LineChart data={weightChart} stroke="var(--fat)" fill="var(--fat)" />
        ) : (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Log your weight at least twice to see your trend ✨
          </p>
        )}

        <div className="mt-3 flex items-center gap-2">
          <input
            value={weightInput}
            onChange={(e) => setWeightInput(e.target.value.replace(/[^\d.,]/g, "").slice(0, 6))}
            onKeyDown={(e) => e.key === "Enter" && saveWeight()}
            inputMode="decimal"
            placeholder={`Today's weight (kg)`}
            className="flex-1 rounded-xl bg-muted px-3 py-2.5 text-sm font-semibold outline-none placeholder:text-muted-foreground"
          />
          <button
            type="button"
            onClick={() => {
              haptic("success")
              saveWeight()
            }}
            disabled={!weightInput}
            className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-40 active:scale-95"
          >
            {weightSaved ? <Check className="h-4 w-4" strokeWidth={3} /> : <Check className="h-4 w-4" strokeWidth={3} />}
            {weightSaved ? "Saved" : "Log"}
          </button>
        </div>

        {(startDelta !== null || goalDelta !== 0) && (
          <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
            {startDelta !== null && startDelta !== 0 && (
              <span className={cn("flex items-center gap-1 rounded-full px-2.5 py-1", startDelta < 0 ? "bg-primary/15 text-primary" : "bg-fat-soft text-fat")}>
                {startDelta < 0 ? <TrendingDown className="h-3.5 w-3.5" /> : <TrendingUp className="h-3.5 w-3.5" />}
                {startDelta > 0 ? "+" : ""}
                {startDelta} kg since start
              </span>
            )}
            <span className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground">
              {Math.abs(goalDelta) < 0.05
                ? "🎉 Goal weight reached!"
                : `${Math.abs(goalDelta)} kg ${goalDelta > 0 ? "to lose" : "to gain"}`}
            </span>
          </div>
        )}
      </section>

      {/* Calorie bars — real history */}
      <section className="rounded-3xl bg-card p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-primary">
              <Flame className="h-4 w-4" />
            </span>
            <h2 className="font-extrabold">Calories · {range}</h2>
          </div>
          <span className="rounded-full bg-accent px-2.5 py-1 text-xs font-bold text-primary">
            {targets.calories} kcal target
          </span>
        </div>
        <BarChart data={chartData} barClassName="bg-primary" />
        <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <span className="inline-block h-0.5 w-4 border-t border-dashed border-muted-foreground/60" />
          Dashed line shows your daily target
        </p>
      </section>

      {/* Goal vs actual */}
      <section className="rounded-3xl bg-card p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-protein-soft text-protein">
            <Target className="h-4 w-4" />
          </span>
          <h2 className="font-extrabold">Objective vs reality</h2>
        </div>

        <div className="space-y-3">
          <GoalBar
            label="Your plan"
            value={targetTotal}
            max={Math.max(targetTotal, actualTotal)}
            className="bg-muted-foreground/40"
            suffix="kcal planned"
          />
          <GoalBar
            label="You ate"
            value={actualTotal}
            max={Math.max(targetTotal, actualTotal)}
            className={ratio <= 1.05 ? "bg-primary" : "bg-carbs"}
            suffix="kcal logged"
          />
        </div>

        <p className="mt-3 text-center text-sm font-semibold text-muted-foreground">
          {logged.length === 0
            ? "Log meals to compare with your plan."
            : ratio <= 0.9
              ? `You're ${Math.round((1 - ratio) * 100)}% under plan — on track for ${account.goal === "lose" ? "weight loss 🎯" : "your goal 🎯"}`
              : ratio <= 1.05
                ? "Right on your plan — perfect consistency! ✨"
                : `${Math.round((ratio - 1) * 100)}% above plan — adjust portions or add a walk 🚶`}
        </p>
      </section>

      {/* Water detail */}
      <section className="rounded-3xl bg-card p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-water-soft text-water">💧</span>
            <h2 className="font-extrabold">Hydration</h2>
          </div>
          <span className="text-xs font-bold text-muted-foreground">
            {totalWater} glasses · goal {targets.water}/day
          </span>
        </div>
        <div className="flex items-end gap-1 sm:gap-1.5" style={{ height: 64 }}>
          {days.slice(-14).map((d) => (
            <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
              <div
                className={cn("w-full max-w-3 rounded-t-md transition-all sm:max-w-none", d.water >= targets.water ? "bg-water" : "bg-water/40")}
                style={{ height: `${Math.min((d.water / Math.max(targets.water, 1)) * 52, 52) + 4}px` }}
                title={`${d.water} glasses`}
              />
            </div>
          ))}
        </div>
        <p className="mt-2 text-center text-[11px] text-muted-foreground">Last 14 days · full bar = daily goal</p>
      </section>

      {/* Today's timeline */}
      <section className="rounded-3xl bg-card p-5 shadow-sm sm:col-span-2">
        <div className="mb-3 flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-primary">
            <Clock3 className="h-4 w-4" />
          </span>
          <h2 className="font-extrabold">Today by hour</h2>
        </div>
        {timeline.length === 0 ? (
          <p className="py-2 text-center text-sm text-muted-foreground">Nothing logged yet today.</p>
        ) : (
          <div className="flex flex-col">
            {timeline.slice(0, 12).map((t, i) => (
              <div key={`${t.meal}-${t.name}-${i}`} className="flex items-center gap-3 border-b border-border py-2 last:border-b-0">
                <span className="w-14 text-xs font-bold tabular-nums text-muted-foreground">
                  {t.at ? new Date(t.at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) : mealMeta[t.meal].emoji}
                </span>
                <span className="text-lg">{t.emoji}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{t.name}</p>
                  <p className="text-[11px] text-muted-foreground">{mealMeta[t.meal].name}</p>
                </div>
                <p className="text-sm font-extrabold tabular-nums">
                  {t.kcal}
                  <span className="text-[10px] font-medium text-muted-foreground"> kcal</span>
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Day history list */}
      <section className="rounded-3xl bg-card p-5 shadow-sm sm:col-span-2">
        <div className="mb-3 flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-steps-soft text-steps">
            <CalendarDays className="h-4 w-4" />
          </span>
          <h2 className="font-extrabold">Day by day</h2>
        </div>
        <div className="flex flex-col">
          {[...days].reverse().slice(0, range === "7 days" ? 7 : 14).map((d) => (
            <div
              key={d.date}
              className="flex items-center gap-3 border-b border-border py-2.5 last:border-b-0"
            >
              <div className="w-16">
                <p className={cn("text-sm font-bold", d.isToday && "text-primary")}>{d.label}</p>
                <p className="text-[11px] text-muted-foreground">
                  {d.date.slice(5)}
                  {d.steps > 0 && <span className="ml-1">· 👣 {d.steps.toLocaleString()}</span>}
                </p>
              </div>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn("h-full rounded-full transition-all", d.calories > targets.calories ? "bg-carbs" : "bg-primary")}
                  style={{ width: `${Math.min((d.calories / targets.calories) * 100, 100)}%` }}
                />
              </div>
              <p className="w-20 text-right text-sm font-extrabold tabular-nums">
                {d.calories > 0 ? d.calories : "—"}
                <span className="text-[10px] font-medium text-muted-foreground"> kcal</span>
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Ad footer — below all content, never interrupting charts or lists */}
      <div className="sm:col-span-2">
        <AdSlot slot={AD_SLOTS.progressFooter} format="footer" />
      </div>
    </div>
  )
}

function GoalBar({ label, value, max, className, suffix }: { label: string; value: number; max: number; className: string; suffix: string }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="font-bold text-muted-foreground">{label}</span>
        <span className="font-extrabold tabular-nums">
          {value.toLocaleString()} <span className="font-medium text-muted-foreground">{suffix}</span>
        </span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full transition-all duration-700", className)} style={{ width: `${max > 0 ? Math.min((value / max) * 100, 100) : 0}%` }} />
      </div>
    </div>
  )
}

function StatCard({
  icon: Icon,
  tone,
  label,
  value,
  sub,
}: {
  icon: typeof Flame
  tone: "carbs" | "fat" | "protein" | "water"
  label: string
  value: string
  sub: string
}) {
  const toneMap = {
    carbs: "bg-carbs-soft text-carbs",
    fat: "bg-fat-soft text-fat",
    protein: "bg-protein-soft text-protein",
    water: "bg-water-soft text-water",
  }[tone]
  return (
    <div className="rounded-2xl bg-card p-4 shadow-sm">
      <span className={cn("flex h-9 w-9 items-center justify-center rounded-xl", toneMap)}>
        <Icon className="h-5 w-5" />
      </span>
      <p className="mt-3 text-2xl font-extrabold tracking-tight tabular-nums">{value}</p>
      <p className="text-sm font-semibold">{label}</p>
      <p className="text-xs text-muted-foreground">{sub}</p>
    </div>
  )
}
