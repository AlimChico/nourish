"use client"

import { Flame, Clock, ChevronRight, Zap } from "lucide-react"
import { BarChart } from "@/components/mini-charts"
import { workoutHistory, workoutTypes } from "@/lib/nutrition-data"
import { cn } from "@/lib/utils"

export function WorkoutScreen() {
  const totalMin = workoutHistory.reduce((s, w) => s + w.minutes, 0)
  const activeDays = workoutHistory.filter((w) => w.minutes > 0).length
  const chartData = workoutHistory.map((w) => ({ day: w.day, value: w.minutes }))

  return (
    <div className="aurora-glow flex flex-col gap-6 px-5 pb-8 pt-2">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight">Workouts</h1>
        <p className="text-sm text-muted-foreground">Move more, feel stronger.</p>
      </header>

      {/* Summary banner */}
      <section className="overflow-hidden rounded-3xl bg-secondary p-6 text-secondary-foreground">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-[#e6fff1]/60">This week</p>
            <p className="mt-1 text-4xl font-extrabold tabular-nums text-[#e6fff1]">
              {totalMin} <span className="text-lg font-bold text-[#e6fff1]/60">min</span>
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
            <p className="text-xs text-[#e6fff1]/60">Calories burned</p>
            <p className="text-xl font-extrabold text-primary">1,240</p>
          </div>
        </div>
      </section>

      {/* Log workout */}
      <section>
        <h2 className="mb-3 text-lg font-extrabold tracking-tight">Log a workout</h2>
        <div className="grid grid-cols-3 gap-3">
          {workoutTypes.map((w) => (
            <button
              key={w.id}
              type="button"
              className="flex flex-col items-center gap-1 rounded-2xl bg-card p-4 shadow-sm transition-transform active:scale-95"
            >
              <span className="text-3xl">{w.emoji}</span>
              <span className="text-xs font-bold">{w.label}</span>
              <span className="text-[10px] text-muted-foreground">{w.calories}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Weekly chart */}
      <section className="rounded-3xl bg-card p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-fat-soft text-fat">
            <Clock className="h-4 w-4" />
          </span>
          <h2 className="font-extrabold">Minutes per day</h2>
        </div>
        <BarChart data={chartData} barClassName="bg-fat" />
      </section>

      {/* History */}
      <section>
        <h2 className="mb-3 text-lg font-extrabold tracking-tight">Recent activity</h2>
        <div className="flex flex-col gap-2">
          {workoutHistory
            .filter((w) => w.minutes > 0)
            .map((w) => (
              <div key={w.day} className="flex items-center gap-3 rounded-2xl bg-card p-4 shadow-sm">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-primary">
                  <Flame className="h-5 w-5" />
                </span>
                <div className="flex-1">
                  <p className="font-bold">{w.type}</p>
                  <p className="text-xs text-muted-foreground">{w.day}</p>
                </div>
                <span className="text-sm font-bold tabular-nums text-muted-foreground">{w.minutes} min</span>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </div>
            ))}
        </div>
      </section>
    </div>
  )
}
