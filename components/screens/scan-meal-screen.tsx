"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  X,
  ScanLine,
  Camera,
  ImagePlus,
  Check,
  Sparkles,
  Minus,
  Plus,
  RotateCcw,
  Loader2,
  Lightbulb,
  AlertTriangle,
} from "lucide-react"
import { useFoodLog, type FoodItem, type MealKey } from "@/lib/food-log"
import { analyzeMealReal, targetForTime, type ScanResult, type ScannedItem } from "@/lib/meal-scan"
import { mealMeta } from "@/lib/food-log"
import { cn } from "@/lib/utils"

type Phase = "capture" | "analyzing" | "review"

export function ScanMealScreen({ onClose }: { onClose: () => void }) {
  const { addFood } = useFoodLog()
  const [phase, setPhase] = useState<Phase>("capture")
  const [meal, setMeal] = useState<MealKey>(targetForTime)
  const [result, setResult] = useState<ScanResult | null>(null)
  const [kept, setKept] = useState<Record<number, boolean>>({})
  const [qtys, setQtys] = useState<Record<number, number>>({})
  const [thumbnail, setThumbnail] = useState<string | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const [flash, setFlash] = useState(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }, [])

  const startCamera = useCallback(async () => {
    setError(null)
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("Caméra non disponible ici — importe une photo de ton plat.")
        return
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play().catch(() => {})
      }
    } catch {
      setError("Caméra inaccessible — autorise l'accès ou importe une photo.")
    }
  }, [])

  useEffect(() => {
    void startCamera()
    return () => stopCamera()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const capture = useCallback(() => {
    const video = videoRef.current
    let thumb: string | undefined
    try {
      if (video && video.videoWidth > 0) {
        const canvas = document.createElement("canvas")
        const side = Math.min(video.videoWidth, video.videoHeight, 640)
        canvas.width = side
        canvas.height = side
        const ctx = canvas.getContext("2d")
        if (ctx) {
          const sx = (video.videoWidth - side) / 2
          const sy = (video.videoHeight - side) / 2
          ctx.drawImage(video, sx, sy, side, side, 0, 0, side, side)
          thumb = canvas.toDataURL("image/jpeg", 0.85)
        }
      }
    } catch {
      thumb = undefined
    }
    setFlash(true)
    setTimeout(() => setFlash(false), 180)
    void runAnalysis(thumb)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onPickFile = useCallback((file: File) => {
    const reader = new FileReader()
    reader.onload = () => void runAnalysis(typeof reader.result === "string" ? reader.result : undefined)
    reader.onerror = () => void runAnalysis(undefined)
    reader.readAsDataURL(file)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const runAnalysis = useCallback(async (thumb?: string) => {
    setThumbnail(thumb)
    stopCamera()
    setPhase("analyzing")
    setResult(null)
    try {
      const r = await analyzeMealReal(thumb)
      setResult(r)
      setKept(Object.fromEntries(r.items.map((_, i) => [i, true])))
      setQtys(Object.fromEntries(r.items.map((_, i) => [i, r.items[i].quantity])))
      setPhase("review")
    } catch {
      setError("Analyse impossible — vérifie ta connexion puis réessaie (ou importe une photo).")
      setPhase("capture")
      void startCamera()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const retake = useCallback(() => {
    setResult(null)
    setError(null)
    setPhase("capture")
    void startCamera()
  }, [startCamera])

  const activeItems = result
    ? result.items.filter((_, i) => kept[i] !== false)
    : []

  const saveAll = useCallback(() => {
    if (!result) return
    for (const it of activeItems) {
      const idx = result.items.indexOf(it)
      const qty = qtys[idx] ?? it.quantity
      const food: FoodItem = {
        id: `scan_${it.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        name: `${it.name} (${it.portion})`,
        serving: it.portion,
        calories: Math.round(it.calories),
        protein: Math.round(it.protein),
        carbs: Math.round(it.carbs),
        fat: Math.round(it.fat),
        emoji: foodEmoji(it.name),
      }
      addFood(meal, food, qty)
    }
    onClose()
  }, [result, activeItems, qtys, meal, addFood, onClose])

  return (
    <div className="safe-top absolute inset-0 z-30 flex flex-col bg-background animate-slide-up">
      {/* Header */}
      <div className={cn("flex items-center justify-between px-5 py-3", phase !== "review" && "text-[#e6fff1]")}>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-xl",
              phase === "review" ? "bg-accent text-primary" : "bg-[#a7f3d0]/10 text-[#e6fff1]",
            )}
          >
            <ScanLine className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-lg font-extrabold leading-tight tracking-tight">Scan meal</h1>
            <p className={cn("text-xs", phase === "review" ? "text-muted-foreground" : "text-[#e6fff1]/60")}>
              {phase === "capture" && "Point at your plate and capture"}
              {phase === "analyzing" && "AI is analyzing your meal…"}
              {phase === "review" && "Review what we detected"}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close scanner"
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-full",
            phase === "review" ? "bg-muted" : "bg-[#a7f3d0]/10 text-[#e6fff1]",
          )}
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Body */}
      {phase !== "review" ? (
        <div className="relative flex flex-1 flex-col overflow-hidden bg-secondary">
          {/* Viewfinder */}
          <div className="relative flex-1 overflow-hidden">
            <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
            {thumbnail && phase === "analyzing" && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={thumbnail} alt="Captured meal" className="absolute inset-0 h-full w-full object-cover" />
            )}
            {error && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-secondary/90 px-8 text-center text-[#e6fff1]">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#a7f3d0]/10">
                  <Camera className="h-7 w-7 text-[#e6fff1]/70" />
                </span>
                <p className="text-sm text-[#e6fff1]/80">{error}</p>
              </div>
            )}

            {/* Scan frame overlay */}
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute inset-x-8 inset-y-10 rounded-3xl border-2 border-[#a7f3d0]/20/40" />
              <div className="absolute inset-x-8 inset-y-10 overflow-hidden rounded-3xl">
                {phase === "capture" && (
                  <div className="scan-sweep absolute inset-x-0 h-1/3 bg-gradient-to-b from-transparent via-primary/30 to-transparent" />
                )}
                {phase === "analyzing" && (
                  <div className="scan-sweep absolute inset-x-0 h-1/4 bg-gradient-to-b from-transparent via-primary/50 to-transparent" />
                )}
                {/* detection corners */}
                <span className="absolute left-3 top-3 h-6 w-6 rounded-tl-xl border-l-4 border-t-4 border-primary" />
                <span className="absolute right-3 top-3 h-6 w-6 rounded-tr-xl border-r-4 border-t-4 border-primary" />
                <span className="absolute bottom-3 left-3 h-6 w-6 rounded-bl-xl border-b-4 border-l-4 border-primary" />
                <span className="absolute bottom-3 right-3 h-6 w-6 rounded-br-xl border-b-4 border-r-4 border-primary" />
              </div>
              {phase === "analyzing" && (
                <div className="absolute inset-x-0 top-1/2 flex -translate-y-1/2 flex-col items-center gap-2">
                  <span className="flex items-center gap-2 rounded-full bg-secondary/80 px-4 py-2 text-sm font-bold text-[#e6fff1] backdrop-blur">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    Identifying your food…
                  </span>
                </div>
              )}
            </div>

            {flash && <div className="absolute inset-0 bg-[#e6fff1]/80" />}
          </div>

          {/* Meal picker + actions */}
          <div className="flex flex-col gap-4 bg-secondary px-6 pb-8 pt-5 text-[#e6fff1]">
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[#e6fff1]/50">Add to</p>
              <div className="grid grid-cols-4 gap-2">
                {(Object.keys(mealMeta) as MealKey[]).map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setMeal(key)}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-xl border py-2.5 text-[11px] font-bold transition-all",
                      meal === key
                        ? "border-primary bg-primary/20 text-[#e6fff1]"
                        : "border-[#a7f3d0]/10 bg-[#a7f3d0]/5 text-[#e6fff1]/60",
                    )}
                  >
                    <span className="text-lg">{mealMeta[key].emoji}</span>
                    {mealMeta[key].name}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                aria-label="Upload a photo"
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#a7f3d0]/10 active:scale-95"
              >
                <ImagePlus className="h-6 w-6" />
              </button>
              <button
                type="button"
                onClick={capture}
                aria-label="Capture meal photo"
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-base font-extrabold text-primary-foreground shadow-lg shadow-primary/30 transition-transform active:scale-[0.98]"
              >
                <Camera className="h-5 w-5" />
                Capture & analyze
              </button>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) onPickFile(f)
                e.target.value = ""
              }}
            />
            <p className="text-center text-[11px] text-[#e6fff1]/40">
              Powered by AI vision — real recognition of your plate.
            </p>
          </div>
        </div>
      ) : (
        /* ---------- Review ---------- */
        <div className="flex flex-1 flex-col overflow-hidden sm:mx-auto sm:w-full sm:max-w-2xl">
          <div className="min-h-0 flex-1 overflow-y-auto no-scrollbar px-5 pb-6">
            {result?.thumbnail && (
              <div className="relative mt-2 overflow-hidden rounded-3xl">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={result.thumbnail} alt="Scanned meal" className="aspect-video w-full object-cover" />
                <span className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full bg-secondary/85 px-3 py-1.5 text-xs font-bold text-[#e6fff1] backdrop-blur">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  {activeItems.length} food{activeItems.length > 1 ? "s" : ""} detected
                </span>
              </div>
            )}

            {/* Dish name + description */}
            {result && (
              <div className="mt-4">
                <h2 className="text-xl font-extrabold tracking-tight">{result.dish}</h2>
                {result.description && (
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{result.description}</p>
                )}
            {result.source === "demo" && (
              <p className="mt-2 flex items-center gap-1.5 rounded-xl bg-carbs-soft px-3 py-2 text-xs font-semibold text-carbs">
                <AlertTriangle className="h-3.5 w-3.5" />
                {result.description}
              </p>
            )}
              </div>
            )}

            <p className="mt-5 text-sm font-bold uppercase tracking-wide text-muted-foreground">
              Detected in {mealMeta[meal].name}
            </p>
            <div className="mt-3 flex flex-col gap-3">
              {result?.items.map((it, i) => (
                <DetectedRow
                  key={`${it.name}-${i}`}
                  item={it}
                  kept={kept[i] !== false}
                  qty={qtys[i] ?? it.quantity}
                  onToggle={() => setKept((k) => ({ ...k, [i]: !(k[i] !== false) }))}
                  onQty={(q) => setQtys((s) => ({ ...s, [i]: q }))}
                />
              ))}
            </div>

            {result && activeItems.length > 0 && <TotalsCard items={activeItems} />}

            {result?.tips && (
              <div className="mt-4 flex items-start gap-2.5 rounded-2xl bg-accent p-4">
                <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <p className="text-sm font-medium leading-relaxed text-accent-foreground">{result.tips}</p>
              </div>
            )}

            <button
              type="button"
              onClick={retake}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-border py-3 text-sm font-bold text-muted-foreground active:scale-[0.99]"
            >
              <RotateCcw className="h-4 w-4" />
              Scan again
            </button>
          </div>

          <div className="border-t border-border bg-card px-5 pb-8 pt-4">
            <button
              type="button"
              onClick={saveAll}
              disabled={activeItems.length === 0}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-base font-extrabold text-primary-foreground shadow-lg shadow-primary/30 transition-transform active:scale-[0.98] disabled:opacity-40"
            >
              <Check className="h-5 w-5" strokeWidth={3} />
              Log {activeItems.length > 0 ? `${activeItems.length} item${activeItems.length > 1 ? "s" : ""} ` : ""}to{" "}
              {mealMeta[meal].name}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function foodEmoji(name: string): string {
  const n = name.toLowerCase()
  if (/chicken|poulet|turkey|steak|beef|meat|merguez|kefta/.test(n)) return "🍗"
  if (/fish|salmon|tuna|sardine|thon/.test(n)) return "🐟"
  if (/rice|riz|couscous|pasta|noodle|bread|pain|baguette|khobz|oat/.test(n)) return "🌾"
  if (/salad|salade|lettuce|greens|vegetable|legume|broccoli|tomato|tomate|pepper|poivron/.test(n)) return "🥗"
  if (/egg|oeuf|omelet/.test(n)) return "🥚"
  if (/cheese|fromage|yogurt|yaourt|milk|lait/.test(n)) return "🧀"
  if (/fruit|apple|pomme|banana|banane|orange|grape|raisin|berry/.test(n)) return "🍎"
  if (/oil|huile|sauce|dressing|butter|beurre/.test(n)) return "🫗"
  if (/soup|chorba|broth|bouillon/.test(n)) return "🍲"
  if (/cake|gateau|sweet|dessert|makroudh|pastry/.test(n)) return "🍰"
  return "🍽️"
}

function DetectedRow({
  item,
  kept,
  qty,
  onToggle,
  onQty,
}: {
  item: ScannedItem
  kept: boolean
  qty: number
  onToggle: () => void
  onQty: (q: number) => void
}) {
  const kcal = Math.round(item.calories * qty)
  const confPct = Math.round(item.confidence * 100)
  const confColor =
    item.confidence >= 0.8 ? "text-steps" : item.confidence >= 0.6 ? "text-carbs" : "text-muted-foreground"

  return (
    <div
      className={cn(
        "rounded-2xl bg-card p-4 shadow-sm transition-opacity",
        !kept && "opacity-40",
      )}
    >
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted text-xl">
          {foodEmoji(item.name)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold">{item.name}</p>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="text-xs font-semibold text-muted-foreground">{item.portion}</span>
            <span className="text-xs text-muted-foreground">·</span>
            <span className={cn("text-xs font-bold", confColor)}>{confPct}% sure</span>
            <span className="text-xs text-muted-foreground">·</span>
            <span className="text-xs font-bold tabular-nums">{kcal} kcal</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onQty(Math.max(1, qty - 1))}
            aria-label={`Decrease ${item.name} quantity`}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted active:scale-90 sm:h-9 sm:w-9"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <span className="w-6 text-center text-sm font-extrabold tabular-nums">{qty}</span>
          <button
            type="button"
            onClick={() => onQty(Math.min(9, qty + 1))}
            aria-label={`Increase ${item.name} quantity`}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-primary active:scale-90 sm:h-9 sm:w-9"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onToggle}
            aria-label={kept ? `Exclude ${item.name}` : `Include ${item.name}`}
            className={cn(
              "ml-1 flex h-8 w-8 items-center justify-center rounded-full transition-colors sm:h-9 sm:w-9",
              kept ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
            )}
          >
            <Check className="h-4 w-4" strokeWidth={3} />
          </button>
        </div>
      </div>

      {/* Macro mini-row */}
      <div className="mt-3 grid grid-cols-3 gap-2">
        <MacroChip label="P" value={Math.round(item.protein * qty)} className="bg-protein-soft text-protein" />
        <MacroChip label="C" value={Math.round(item.carbs * qty)} className="bg-carbs-soft text-carbs" />
        <MacroChip label="F" value={Math.round(item.fat * qty)} className="bg-fat-soft text-fat" />
      </div>

      {/* What the AI actually saw */}
      {item.detail && (
        <p className="mt-3 rounded-xl bg-muted/60 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
          <span className="font-bold text-foreground">What we see: </span>
          {item.detail}
        </p>
      )}
    </div>
  )
}

function MacroChip({ label, value, className }: { label: string; value: number; className?: string }) {
  return (
    <div className={cn("rounded-lg py-1.5 text-center", className)}>
      <span className="text-[10px] font-bold uppercase">{label}</span>{" "}
      <span className="text-xs font-extrabold tabular-nums">{value}g</span>
    </div>
  )
}

function TotalsCard({ items }: { items: ScannedItem[] }) {
  const t = items.reduce(
    (acc, it) => ({
      calories: acc.calories + it.calories * it.quantity,
      protein: acc.protein + it.protein * it.quantity,
      carbs: acc.carbs + it.carbs * it.quantity,
      fat: acc.fat + it.fat * it.quantity,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  )
  return (
    <div className="mt-4 grid grid-cols-4 gap-2 rounded-2xl bg-secondary p-4 text-secondary-foreground">
      <Total label="kcal" value={Math.round(t.calories)} accent />
      <Total label="Protein" value={`${Math.round(t.protein)}g`} />
      <Total label="Carbs" value={`${Math.round(t.carbs)}g`} />
      <Total label="Fat" value={`${Math.round(t.fat)}g`} />
    </div>
  )
}

function Total({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="text-center">
      <p className={cn("text-lg font-extrabold tabular-nums", accent ? "text-primary" : "text-[#e6fff1]")}>{value}</p>
      <p className="text-[10px] text-[#e6fff1]/50">{label}</p>
    </div>
  )
}
