"use client"

import { useMemo, useState } from "react"
import { Search, Plus, Clock, Flame, ScanLine, X, Check, Trash2, Camera } from "lucide-react"
import {
  foodCategories,
  foodDatabase,
  popularFoods,
  recentFoods,
  type FoodItem,
} from "@/lib/nutrition-data"
import { tunisianFoods, searchTunisianFoods } from "@/lib/tunisian-foods"
import { mealMeta, useFoodLog, type MealKey } from "@/lib/food-log"
import { targetForTime } from "@/lib/meal-scan"
import { cn } from "@/lib/utils"

export function FoodScreen({ onOpenScan, onOpenBarcode }: { onOpenScan: () => void; onOpenBarcode: () => void }) {
  const { state, addFood } = useFoodLog()
  const [query, setQuery] = useState("")
  const [pending, setPending] = useState<FoodItem[]>([])
  const [meal, setMeal] = useState<MealKey>(targetForTime)

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    const tn = searchTunisianFoods(q)
    const general = foodDatabase.filter((f) => f.name.toLowerCase().includes(q))
    return [...tn, ...general.filter((g) => !tn.some((t) => t.id === g.id))]
  }, [query])

  const queue = (food: FoodItem) => {
    setPending((p) => (p.some((x) => x.id === food.id) ? p.filter((x) => x.id !== food.id) : [...p, food]))
  }

  const logAll = () => {
    for (const food of pending) addFood(meal, food)
    setPending([])
  }

  const pendingCals = pending.reduce((s, f) => s + f.calories, 0)

  return (
    <div className="aurora-glow mx-auto flex w-full max-w-2xl flex-col gap-6 px-5 pb-28 pt-2">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight">Add food</h1>
        <p className="text-sm text-muted-foreground">Search our database of 1M+ foods.</p>
      </header>

      {/* Search + scan */}
      <div className="flex items-center gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-2xl bg-card px-4 py-3 shadow-sm">
          <Search className="h-5 w-5 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search foods..."
            className="w-full bg-transparent text-sm font-medium outline-none placeholder:text-muted-foreground"
          />
          {query && (
            <button type="button" onClick={() => setQuery("")} aria-label="Clear search">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={onOpenBarcode}
          aria-label="Scan a barcode"
          className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary text-secondary-foreground shadow-sm active:scale-95"
        >
          <ScanLine className="h-5 w-5 text-primary" />
        </button>
        <button
          type="button"
          onClick={onOpenScan}
          aria-label="Scan a meal photo"
          className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary text-secondary-foreground shadow-sm active:scale-95"
        >
          <Camera className="h-5 w-5 text-primary" />
        </button>
      </div>

      {results.length > 0 ? (
        <section>
          <SectionTitle>Results</SectionTitle>
          <div className="flex flex-col gap-2">
            {results.map((f) => (
              <FoodRow key={f.id} food={f} added={pending.some((p) => p.id === f.id)} onToggle={() => queue(f)} />
            ))}
          </div>
        </section>
      ) : (
        <>
          {/* Categories */}
          <section>
            <SectionTitle>Categories</SectionTitle>
            <div className="grid grid-cols-4 gap-3 sm:grid-cols-6">
              {foodCategories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="flex flex-col items-center gap-1.5 rounded-2xl bg-card p-3 shadow-sm transition-transform active:scale-95"
                >
                  <span className="text-2xl">{c.emoji}</span>
                  <span className="text-[11px] font-semibold text-muted-foreground">{c.label}</span>
                </button>
              ))}
            </div>
          </section>

          {/* Tunisian specialties 🇹🇳 */}
          <section>
            <SectionTitle icon={<span className="text-base">🇹🇳</span>}>Spécialités tunisiennes</SectionTitle>
            <div className="grid grid-cols-2 gap-2">
              {tunisianFoods.slice(0, 8).map((f) => (
                <TunisianCard key={f.id} food={f} added={pending.some((p) => p.id === f.id)} onToggle={() => queue(f)} />
              ))}
            </div>
            {query && searchTunisianFoods(query).length > 0 && (
              <p className="mt-2 text-xs text-muted-foreground">
                + {searchTunisianFoods(query).length} résultat(s) tunisien(s) dans les résultats ci-dessus
              </p>
            )}
          </section>

          {/* Recent */}
          <section>
            <SectionTitle icon={<Clock className="h-4 w-4" />}>Recent</SectionTitle>
            <div className="flex flex-col gap-2">
              {recentFoods.map((f) => (
                <FoodRow key={f.id} food={f} added={pending.some((p) => p.id === f.id)} onToggle={() => queue(f)} />
              ))}
            </div>
          </section>

          {/* Popular */}
          <section>
            <SectionTitle icon={<Flame className="h-4 w-4" />}>Popular</SectionTitle>
            <div className="flex flex-col gap-2">
              {popularFoods.map((f) => (
                <FoodRow key={f.id} food={f} added={pending.some((p) => p.id === f.id)} onToggle={() => queue(f)} />
              ))}
            </div>
          </section>
        </>
      )}

      {/* Sticky log bar — sticks inside the scroll area, above the nav on every size */}
      {pending.length > 0 && (
        <div className="sticky bottom-3 z-20 mx-auto flex w-full max-w-[600px] justify-center px-5">
          <div className="w-full rounded-3xl bg-secondary p-3 text-secondary-foreground shadow-2xl">
            <div className="mb-2 grid grid-cols-4 gap-2">
              {(Object.keys(mealMeta) as MealKey[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setMeal(key)}
                  className={cn(
                    "flex flex-col items-center gap-0.5 rounded-xl border py-1.5 text-[10px] font-bold transition-all",
                    meal === key ? "border-primary bg-primary/20 text-[#e6fff1]" : "border-[#a7f3d0]/10 bg-[#a7f3d0]/5 text-[#e6fff1]/60",
                  )}
                >
                  <span className="text-base">{mealMeta[key].emoji}</span>
                  {mealMeta[key].name}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPending([])}
                aria-label="Clear selection"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#a7f3d0]/10 text-[#e6fff1]/70 active:scale-95"
              >
                <Trash2 className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={logAll}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-sm font-extrabold text-primary-foreground transition-transform active:scale-[0.98]"
              >
                <Check className="h-4 w-4" strokeWidth={3} />
                Log {pending.length} item{pending.length > 1 ? "s" : ""} · {pendingCals} kcal
              </button>
            </div>
          </div>
        </div>
      )}

      {state.meals[meal].length > 0 && pending.length === 0 && (
        <p className="text-center text-xs text-muted-foreground">
          {mealMeta[meal].name}: {state.meals[meal].length} logged today
        </p>
      )}
    </div>
  )
}

function TunisianCard({ food, added, onToggle }: { food: FoodItem; added: boolean; onToggle: () => void }) {
  return (
    <div className="flex items-center gap-2 rounded-2xl bg-card p-3 shadow-sm">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-xl">{food.emoji}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold">{food.name}</p>
        <p className="text-[11px] text-muted-foreground">{food.calories} kcal · P{food.protein} C{food.carbs} F{food.fat}</p>
      </div>
      <button
        type="button"
        onClick={onToggle}
        aria-label={added ? `Remove ${food.name}` : `Add ${food.name}`}
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all active:scale-90",
          added ? "bg-primary text-primary-foreground" : "bg-accent text-primary",
        )}
      >
        <Plus className={cn("h-4 w-4 transition-transform", added && "rotate-45")} strokeWidth={2.5} />
      </button>
    </div>
  )
}

function SectionTitle({ children, icon }: { children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <h2 className="mb-3 flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-muted-foreground">
      {icon}
      {children}
    </h2>
  )
}

function FoodRow({ food, added, onToggle }: { food: FoodItem; added: boolean; onToggle: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-card p-3 shadow-sm">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted text-xl">
        {food.emoji}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-bold">{food.name}</p>
        <p className="text-xs text-muted-foreground">
          {food.serving} · {food.calories} kcal · P{food.protein} C{food.carbs} F{food.fat}
        </p>
      </div>
      <button
        type="button"
        onClick={onToggle}
        aria-label={added ? `Remove ${food.name}` : `Add ${food.name}`}
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all active:scale-90",
          added ? "bg-primary text-primary-foreground" : "bg-accent text-primary",
        )}
      >
        <Plus className={cn("h-5 w-5 transition-transform", added && "rotate-45")} strokeWidth={2.5} />
      </button>
    </div>
  )
}
