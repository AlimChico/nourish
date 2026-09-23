"use client"

import { useMemo, useState } from "react"
import { TrendingDown, Flame, Award, Target, CalendarDays, Droplets } from "lucide-react"
import { BarChart } from "@/components/mini-charts"
import { dayTotals, useFoodLog, type DayHistory } from "@/lib/food-log"
import { useAccount } from "@/lib/account"
import { useHealth } from "@/lib/health"
import { useStreak } from "@/components/use-streak"
import { cn } from "@/lib/utils"

const ranges = ["Week", "Month"] as const

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
  const { targets } = useAccount()
  const { state: health } = useHealth()
  const streak = useStreak()
  const [range, setRange] = useState<(typeof ranges)[number]>("Week")

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
    const n = range === "Week" ? 7 : 30
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
  }, [range, todayLive, byDate, health.days])

  const chartData = useMemo(
    () =>
      days.map((d) => ({
        day: range === "Week" ? d.label : d.date.slice(8),
        value: d.calories,
        target: targets.calories,
      })),
    [days, range, targets.calories],
  )

  const logged = days.filter((d) => d.calories > 0)
  const avgCals = logged.length > 0 ? Math.round(logged.reduce((s, d) => s + d.calories, 0) / logged.length) : 0

  const goalHit = useMemo(() => {
    if (logged.length === 0) return null
    const onTarget = logged.filter((d) => d.calories <= targets.calories).length
    return Math.round((onTarget / logged.length) * 100)
  }, [logged, targets.calories])

  const totalWater = days.reduce((s, d) => s + d.water, 0)

  return (
    <div className="aurora-glow mx-auto flex w-full max-w-2xl flex-col gap-6 px-5 pb-8 pt-2">
      <header className="flex items-center justify-between">
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
      <div className="flex gap-1 rounded-2xl bg-muted p-1">
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
      <div className="grid grid-cols-2 gap-3">
        <StatCard icon={Flame} tone="carbs" label="Avg intake" value={avgCals > 0 ? `${avgCals}` : "—"} sub="kcal / logged day" />
        <StatCard icon={Award} tone="fat" label="Streak" value={`${streak} day${streak === 1 ? "" : "s"}`} sub={streak > 0 ? "keep going!" : "log today!"} />
        <StatCard icon={Target} tone="protein" label="Goal hit" value={goalHit !== null ? `${goalHit}%` : "—"} sub="of days on target" />
        <StatCard icon={Droplets} tone="water" label="Water" value={`${totalWater}`} sub={`glasses in ${range === "Week" ? "7" : "30"} days`} />
      </div>

      {/* Calorie bars — real history */}
      <section className="rounded-3xl bg-card p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-primary">
              <Flame className="h-4 w-4" />
            </span>
            <h2 className="font-extrabold">{range === "Week" ? "Calories this week" : "Calories this month"}</h2>
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

      {/* Day history list */}
      <section className="rounded-3xl bg-card p-5 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-steps-soft text-steps">
            <CalendarDays className="h-4 w-4" />
          </span>
          <h2 className="font-extrabold">Day by day</h2>
        </div>
        <div className="flex flex-col">
          {[...days].reverse().map((d) => (
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
