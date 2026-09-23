"use client"

import { useMemo, useState } from "react"
import { X, Calculator, Flame, Activity, Target } from "lucide-react"
import { AnimatedCounter } from "@/components/animated-counter"
import { activityLevels, calcNutrition } from "@/lib/nutrition-data"
import { cn } from "@/lib/utils"

type Goal = "lose" | "maintain" | "gain"
type Gender = "male" | "female"

export function CalculatorScreen({ onClose }: { onClose: () => void }) {
  const [gender, setGender] = useState<Gender>("female")
  const [age, setAge] = useState(28)
  const [height, setHeight] = useState(168)
  const [weight, setWeight] = useState(72)
  const [activity, setActivity] = useState(1.55)
  const [goal, setGoal] = useState<Goal>("maintain")

  const result = useMemo(
    () => calcNutrition({ gender, age, height, weight, activity, goal }),
    [gender, age, height, weight, activity, goal],
  )

  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-background animate-slide-up">
      <div className="flex items-center justify-between px-5 py-3">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-primary">
            <Calculator className="h-5 w-5" />
          </span>
          <h1 className="text-lg font-extrabold tracking-tight">Calorie Calculator</h1>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close calculator"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-muted"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar px-5 pb-8">
        {/* Result banner */}
        <div className="rounded-3xl bg-secondary p-6 text-center text-secondary-foreground">
          <p className="text-sm font-medium text-[#e6fff1]/70">Recommended daily intake</p>
          <div className="mt-1 flex items-end justify-center gap-2">
            <span className="text-5xl font-extrabold tabular-nums text-primary">
              <AnimatedCounter value={result.calories} />
            </span>
            <span className="pb-2 text-lg font-bold text-[#e6fff1]/70">kcal</span>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <MiniStat icon={<Flame className="h-4 w-4" />} label="BMR" value={`${result.bmr}`} />
            <MiniStat icon={<Activity className="h-4 w-4" />} label="TDEE" value={`${result.tdee}`} />
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <MacroPill label="Protein" value={result.protein} className="text-protein" />
            <MacroPill label="Carbs" value={result.carbs} className="text-carbs" />
            <MacroPill label="Fat" value={result.fat} className="text-fat" />
          </div>
        </div>

        {/* Goal */}
        <div className="mt-6">
          <Label icon={<Target className="h-4 w-4" />}>Goal</Label>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                { k: "lose", l: "Lose" },
                { k: "maintain", l: "Maintain" },
                { k: "gain", l: "Gain" },
              ] as { k: Goal; l: string }[]
            ).map((g) => (
              <button
                key={g.k}
                type="button"
                onClick={() => setGoal(g.k)}
                className={cn(
                  "rounded-xl border-2 py-3 text-sm font-bold transition-all",
                  goal === g.k ? "border-primary bg-accent" : "border-border bg-card text-muted-foreground",
                )}
              >
                {g.l}
              </button>
            ))}
          </div>
        </div>

        {/* Gender */}
        <div className="mt-5">
          <Label>Gender</Label>
          <div className="grid grid-cols-2 gap-3">
            {(["female", "male"] as Gender[]).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGender(g)}
                className={cn(
                  "rounded-xl border-2 py-3 text-sm font-bold capitalize transition-all",
                  gender === g ? "border-primary bg-accent" : "border-border bg-card text-muted-foreground",
                )}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        {/* Sliders */}
        <Slider label="Age" value={age} unit="yrs" min={14} max={90} onChange={setAge} />
        <Slider label="Height" value={height} unit="cm" min={130} max={220} onChange={setHeight} />
        <Slider label="Weight" value={weight} unit="kg" min={35} max={200} onChange={setWeight} />

        {/* Activity */}
        <div className="mt-5">
          <Label icon={<Activity className="h-4 w-4" />}>Activity level</Label>
          <div className="space-y-2">
            {activityLevels.map((a) => (
              <button
                key={a.value}
                type="button"
                onClick={() => setActivity(a.value)}
                className={cn(
                  "flex w-full items-center justify-between rounded-xl border-2 px-4 py-3 text-left transition-all",
                  activity === a.value ? "border-primary bg-accent" : "border-border bg-card",
                )}
              >
                <span className="text-sm font-bold">{a.label}</span>
                <span className="text-xs text-muted-foreground">{a.desc}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function MiniStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-[#a7f3d0]/10 px-4 py-3 text-left">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#a7f3d0]/10 text-primary">{icon}</span>
      <span>
        <span className="block text-xs text-[#e6fff1]/60">{label}</span>
        <span className="block text-lg font-extrabold tabular-nums text-[#e6fff1]">{value}</span>
      </span>
    </div>
  )
}

function MacroPill({ label, value, className }: { label: string; value: number; className?: string }) {
  return (
    <div className="rounded-xl bg-[#a7f3d0]/10 py-2 text-center">
      <p className="text-[11px] text-[#e6fff1]/60">{label}</p>
      <p className={cn("text-sm font-extrabold tabular-nums", className)}>{value}g</p>
    </div>
  )
}

function Label({ children, icon }: { children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <label className="mb-2 flex items-center gap-1.5 text-sm font-bold">
      {icon}
      {children}
    </label>
  )
}

function Slider({
  label,
  value,
  unit,
  min,
  max,
  onChange,
}: {
  label: string
  value: number
  unit: string
  min: number
  max: number
  onChange: (n: number) => void
}) {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <div className="mt-5">
      <div className="mb-2 flex items-center justify-between">
        <Label>{label}</Label>
        <span className="text-sm font-extrabold tabular-nums">
          {value} <span className="text-xs font-medium text-muted-foreground">{unit}</span>
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-2 w-full cursor-pointer appearance-none rounded-full outline-none [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-md [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-primary"
        style={{ background: `linear-gradient(to right, var(--primary) ${pct}%, var(--muted) ${pct}%)` }}
      />
    </div>
  )
}
