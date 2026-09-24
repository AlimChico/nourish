"use client"

import { useEffect, useMemo, useState } from "react"
import { Search, Plus, Clock, Flame, ScanLine, X, Check, Trash2, Camera, Globe2, ChefHat, HandHeart, Loader2 } from "lucide-react"
import {
  foodCategories,
  foodDatabase,
  popularFoods,
  recentFoods,
  type FoodItem,
} from "@/lib/nutrition-data"
import { tunisianFoods, searchTunisianFoods } from "@/lib/tunisian-foods"
import {
  listCustomFoods,
  saveCustomFood,
  deleteCustomFood,
  addFoodRequest,
  listRequests,
  removeFoodRequest,
  searchCustomFoods,
  type CustomFood,
} from "@/lib/food-requests"
import { mealMeta, useFoodLog, type MealKey } from "@/lib/food-log"
import { targetForTime } from "@/lib/meal-scan"
import { AdSlot, AD_SLOTS } from "@/components/ad-slot"
import { cn } from "@/lib/utils"

type OffResult = FoodItem & { _off?: boolean }

export function FoodScreen({ onOpenScan, onOpenBarcode }: { onOpenScan: () => void; onOpenBarcode: () => void }) {
  const { state, addFood } = useFoodLog()
  const [query, setQuery] = useState("")
  const [pending, setPending] = useState<FoodItem[]>([])
  const [meal, setMeal] = useState<MealKey>(targetForTime)
  const [customTick, setCustomTick] = useState(0) // re-render after custom food mutations
  const [showCreator, setShowCreator] = useState(false)
  const [reqName, setReqName] = useState("")
  const [reqNote, setReqNote] = useState("")
  const [reqSent, setReqSent] = useState(false)

  // Worldwide search via Open Food Facts (debounced, only for real queries)
  const [offResults, setOffResults] = useState<OffResult[]>([])
  const [offLoading, setOffLoading] = useState(false)
  useEffect(() => {
    const q = query.trim()
    if (q.length < 3) {
      setOffResults([])
      setOffLoading(false)
      return
    }
    setOffLoading(true)
    const ctrl = new AbortController()
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/food-search?name=${encodeURIComponent(q)}`, { signal: ctrl.signal })
        const data = (await res.json().catch(() => null)) as { foods?: OffResult[] } | null
        setOffResults(data?.foods ?? [])
      } catch {
        setOffResults([])
      } finally {
        setOffLoading(false)
      }
    }, 450)
    return () => {
      clearTimeout(t)
      ctrl.abort()
    }
  }, [query])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    const tn = searchTunisianFoods(q)
    const custom = searchCustomFoods(q)
    const general = foodDatabase.filter((f) => f.name.toLowerCase().includes(q))
    const seen = new Set([...tn, ...custom].map((f) => f.name.toLowerCase()))
    return [...custom, ...tn, ...general.filter((g) => !seen.has(g.name.toLowerCase()))]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, customTick])

  const queue = (food: FoodItem) => {
    setPending((p) => (p.some((x) => x.id === food.id) ? p.filter((x) => x.id !== food.id) : [...p, food]))
  }

  const logAll = () => {
    for (const food of pending) addFood(meal, food)
    setPending([])
  }

  const pendingCals = pending.reduce((s, f) => s + f.calories, 0)
  const customs = listCustomFoods()
  const requests = listRequests()

  const sendRequest = () => {
    if (reqName.trim().length < 2) return
    addFoodRequest(reqName, reqNote)
    setReqName("")
    setReqNote("")
    setReqSent(true)
    window.setTimeout(() => setReqSent(false), 2500)
  }

  return (
    <div className="aurora-glow mx-auto flex w-full flex-col gap-6 px-5 pb-40 pt-2 sm:px-6">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight">Add food</h1>
        <p className="text-sm text-muted-foreground">Millions of foods worldwide + your own recipes.</p>
      </header>

      {/* Search + scan */}
      <div className="flex items-center gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-2xl bg-card px-4 py-3 shadow-sm">
          <Search className="h-5 w-5 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search worldwide foods…"
            className="w-full bg-transparent text-sm font-medium outline-none placeholder:text-muted-foreground"
          />
          {offLoading && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
          {query && (
            <button type="button" onClick={() => setQuery("")} aria-label="Clear search">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
        </div>
        <button type="button" onClick={onOpenBarcode} aria-label="Scan a barcode" className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary text-secondary-foreground shadow-sm active:scale-95">
          <ScanLine className="h-5 w-5 text-primary" />
        </button>
        <button type="button" onClick={onOpenScan} aria-label="Scan a meal photo" className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary text-secondary-foreground shadow-sm active:scale-95">
          <Camera className="h-5 w-5 text-primary" />
        </button>
      </div>

      {results.length > 0 || offResults.length > 0 ? (
        <section className="animate-fade-in">
          <SectionTitle>Results</SectionTitle>
          <div className="flex flex-col gap-2 sm:grid sm:grid-cols-2 sm:items-start sm:gap-3">
            {results.map((f, i) => (
              <FoodFragment key={f.id} f={f} i={i} pending={pending} queue={queue} offCount={offResults.length} />
            ))}
            {offResults.filter((o) => !results.some((r) => r.name.toLowerCase() === o.name.toLowerCase())).slice(0, 8).map((o, j) => (
              <FoodRow key={o.id} food={o} added={pending.some((p) => p.id === o.id)} onToggle={() => queue(o)} badge="🌍 OFF" />
            ))}
          </div>
        </section>
      ) : (
        <>
          {/* Categories */}
          <section className="animate-fade-in">
            <SectionTitle>Categories</SectionTitle>
            <div className="grid grid-cols-4 gap-3 sm:grid-cols-6 lg:grid-cols-8">
              {foodCategories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setQuery(c.label)}
                  className="flex flex-col items-center gap-1.5 rounded-2xl bg-card p-3 shadow-sm transition-transform active:scale-95"
                >
                  <span className="text-2xl">{c.emoji}</span>
                  <span className="text-[11px] font-semibold text-muted-foreground">{c.label}</span>
                </button>
              ))}
            </div>
          </section>

          {/* Custom foods */}
          <section className="animate-fade-in">
            <div className="mb-3 flex items-center justify-between">
              <SectionTitleInline icon={<ChefHat className="h-4 w-4" />}>My foods & recipes</SectionTitleInline>
              <button
                type="button"
                onClick={() => setShowCreator((s) => !s)}
                className="flex items-center gap-1 rounded-xl bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground active:scale-95"
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={3} /> Create
              </button>
            </div>

            {showCreator && (
              <CustomFoodCreator
                onCreate={(f) => {
                  saveCustomFood(f)
                  setShowCreator(false)
                  setCustomTick((t) => t + 1)
                }}
              />
            )}

            <div className="flex flex-col gap-2 sm:grid sm:grid-cols-2 sm:items-start sm:gap-3">
              {customs.length === 0 && !showCreator && (
                <p className="rounded-2xl border border-dashed border-[#a7f3d0]/20 p-4 text-center text-xs text-muted-foreground">
                  Create your recipes — grandma&apos;s couscous, your protein shake… they&apos;ll live here.
                </p>
              )}
              {customs.map((f) => (
                <div key={f.id} className="animate-fade-in">
                  <div className="flex items-center gap-3 rounded-2xl bg-card p-3 shadow-sm">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted text-xl">{f.emoji}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold">{f.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {f.serving} · {f.calories} kcal · P{f.protein} C{f.carbs} F{f.fat}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => queue(f)}
                      aria-label={`Add ${f.name}`}
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all active:scale-90",
                        pending.some((p) => p.id === f.id) ? "bg-primary text-primary-foreground" : "bg-accent text-primary",
                      )}
                    >
                      <Plus className={cn("h-5 w-5 transition-transform", pending.some((p) => p.id === f.id) && "rotate-45")} strokeWidth={2.5} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        deleteCustomFood(f.id)
                        setCustomTick((t) => t + 1)
                      }}
                      aria-label={`Delete ${f.name}`}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-muted-foreground active:scale-90"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Request a food */}
          <section className="animate-fade-in rounded-3xl bg-card p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <HandHeart className="h-5 w-5 text-primary" />
              <h2 className="font-extrabold">Missing a food? Ask us to add it</h2>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              We&apos;ll add the most requested foods to the global database.
            </p>
            <div className="mt-3 flex gap-2">
              <input
                value={reqName}
                onChange={(e) => setReqName(e.target.value)}
                placeholder="Food name (e.g. Brik à l'œuf light)"
                className="flex-1 rounded-xl bg-muted px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground"
              />
              <button
                type="button"
                onClick={sendRequest}
                disabled={reqName.trim().length < 2}
                className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-40 active:scale-95"
              >
                {reqSent ? <Check className="h-4 w-4" strokeWidth={3} /> : "Send"}
              </button>
            </div>
            {reqSent && <p className="mt-2 animate-fade-in text-xs font-bold text-primary">Request received — thank you! 🙏</p>}
            {reqNote.trim() && (
              <input
                value={reqNote}
                onChange={(e) => setReqNote(e.target.value)}
                placeholder="Optional detail (brand, recipe…)"
                className="mt-2 w-full rounded-xl bg-muted px-3 py-2 text-xs outline-none placeholder:text-muted-foreground"
              />
            )}
            {requests.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {requests.slice(0, 6).map((r) => (
                  <span key={r.id} className="flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-[11px] font-bold text-primary">
                    {r.name}
                    <button type="button" onClick={() => removeFoodRequest(r.id)} aria-label="Remove request">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </section>

          {/* Tunisian specialties */}
          <section className="animate-fade-in">
            <SectionTitle icon={<span className="text-base">🇹🇳</span>}>Spécialités tunisiennes</SectionTitle>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
              {tunisianFoods.slice(0, 8).map((f) => (
                <TunisianCard key={f.id} food={f} added={pending.some((p) => p.id === f.id)} onToggle={() => queue(f)} />
              ))}
            </div>
          </section>

          {/* Recent */}
          <section className="animate-fade-in">
            <SectionTitle icon={<Clock className="h-4 w-4" />}>Recent</SectionTitle>
            <div className="flex flex-col gap-2 sm:grid sm:grid-cols-2 sm:items-start sm:gap-3">
              {recentFoods.map((f) => (
                <FoodRow key={f.id} food={f} added={pending.some((p) => p.id === f.id)} onToggle={() => queue(f)} />
              ))}
            </div>
          </section>

          {/* Popular */}
          <section className="animate-fade-in">
            <SectionTitle icon={<Flame className="h-4 w-4" />}>Popular</SectionTitle>
            <div className="flex flex-col gap-2 sm:grid sm:grid-cols-2 sm:items-start sm:gap-3">
              {popularFoods.map((f) => (
                <FoodRow key={f.id} food={f} added={pending.some((p) => p.id === f.id)} onToggle={() => queue(f)} />
              ))}
            </div>
          </section>
        </>
      )}

      {/* Sticky log bar */}
      {pending.length > 0 && (
        <div className="sticky bottom-3 z-20 mx-auto flex w-full max-w-[600px] justify-center px-1">
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
    </div>
  )
}

function CustomFoodCreator({ onCreate }: { onCreate: (f: Omit<CustomFood, "category" | "createdAt" | "id">) => void }) {
  const [name, setName] = useState("")
  const [calories, setCalories] = useState("")
  const [protein, setProtein] = useState("")
  const [carbs, setCarbs] = useState("")
  const [fat, setFat] = useState("")
  const [serving, setServing] = useState("1 portion")
  const [emoji, setEmoji] = useState("🍲")

  const valid = name.trim().length >= 2 && Number(calories) > 0
  const EMOJIS = ["🍲", "🥗", "🍳", "🥘", "🍜", "🥤", "🍰", "🥙", "🌮", "🍣"]

  return (
    <div className="mb-3 animate-fade-in rounded-2xl border border-[#a7f3d0]/20 bg-card p-4">
      <div className="flex flex-wrap gap-1.5">
        {EMOJIS.map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => setEmoji(e)}
            className={cn("flex h-9 w-9 items-center justify-center rounded-xl text-lg transition-all active:scale-90", emoji === e ? "bg-primary/25 ring-1 ring-primary" : "bg-muted")}
          >
            {e}
          </button>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Recipe name" className="col-span-2 rounded-xl bg-muted px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground" />
        <input value={calories} onChange={(e) => setCalories(e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="Calories (kcal)" className="rounded-xl bg-muted px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground" />
        <input value={serving} onChange={(e) => setServing(e.target.value)} placeholder="Serving (1 portion)" className="rounded-xl bg-muted px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground" />
        <input value={protein} onChange={(e) => setProtein(e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="Protein (g)" className="rounded-xl bg-muted px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground" />
        <input value={carbs} onChange={(e) => setCarbs(e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="Carbs (g)" className="rounded-xl bg-muted px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground" />
        <input value={fat} onChange={(e) => setFat(e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="Fat (g)" className="rounded-xl bg-muted px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground" />
      </div>
      <button
        type="button"
        disabled={!valid}
        onClick={() =>
          onCreate({
            name: name.trim(),
            serving: serving.trim() || "1 portion",
            calories: Number(calories) || 0,
            protein: Number(protein) || 0,
            carbs: Number(carbs) || 0,
            fat: Number(fat) || 0,
            emoji,
            servings: 1,
          })
        }
        className="mt-3 w-full rounded-2xl bg-primary py-3 text-sm font-extrabold text-primary-foreground disabled:opacity-40 active:scale-[0.98]"
      >
        Save my food
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

function SectionTitleInline({ children, icon }: { children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-muted-foreground">
      {icon}
      {children}
    </h2>
  )
}

function FoodRow({ food, added, onToggle, badge }: { food: FoodItem; added: boolean; onToggle: () => void; badge?: string }) {
  return (
    <div className="animate-fade-in flex items-center gap-3 rounded-2xl bg-card p-3 shadow-sm">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted text-xl">{food.emoji}</span>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 truncate font-bold">
          <span className="truncate">{food.name}</span>
          {badge && <span className="shrink-0 rounded-full bg-accent px-1.5 py-0.5 text-[9px] font-black text-primary">{badge}</span>}
        </p>
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

/** One search result — with a single ad inserted every 9 results (never first, never blocking). */
const AD_EVERY = 9
function FoodFragment({
  f,
  i,
  pending,
  queue,
}: {
  f: FoodItem
  i: number
  pending: FoodItem[]
  queue: (food: FoodItem) => void
  offCount: number
}) {
  void 0
  return (
    <>
      <FoodRow food={f} added={pending.some((p) => p.id === f.id)} onToggle={() => queue(f)} />
      {i > 0 && (i + 1) % AD_EVERY === 0 && (
        <AdSlot slot={AD_SLOTS.foodResults} format="inline" className="my-1" />
      )}
    </>
  )
}

function TunisianCard({ food, added, onToggle }: { food: FoodItem; added: boolean; onToggle: () => void }) {
  return (
    <div className="animate-fade-in flex items-center gap-2 rounded-2xl bg-card p-3 shadow-sm">
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
