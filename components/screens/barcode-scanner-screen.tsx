"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { BrowserMultiFormatReader } from "@zxing/browser"
import type { IScannerControls } from "@zxing/browser"
import { DecodeHintType, BarcodeFormat } from "@zxing/library"
import { X, ScanLine, Loader2, Plus, Minus, Check, AlertTriangle, Camera, BarChart3 } from "lucide-react"
import { useFoodLog, mealMeta, type MealKey, type FoodItem } from "@/lib/food-log"
import { targetForTime } from "@/lib/meal-scan"
import { cn } from "@/lib/utils"

type Phase = "scanning" | "lookup" | "found" | "error"

type OFFProduct = {
  code: string
  name: string
  brand: string | null
  image: string | null
  serving: string
  per100g: { calories: number | null; protein: number | null; carbs: number | null; fat: number | null } | null
  perServing: { calories: number | null; protein: number | null; carbs: number | null; fat: number | null } | null
  nutriscore: string | null
}

const n = (v: number | null) => (v === null ? 0 : v)

function productToFood(p: OFFProduct, servings: number): FoodItem {
  const src = p.perServing ?? p.per100g ?? { calories: 0, protein: 0, carbs: 0, fat: 0 }
  return {
    id: `off_${p.code}`,
    name: p.brand ? `${p.name} (${p.brand})` : p.name,
    serving: p.serving,
    calories: Math.round(n(src.calories) * servings),
    protein: Math.round(n(src.protein) * servings),
    carbs: Math.round(n(src.carbs) * servings),
    fat: Math.round(n(src.fat) * servings),
    emoji: "📦",
  }
}

export function BarcodeScannerScreen({ onClose }: { onClose: () => void }) {
  const { addFood } = useFoodLog()
  const [phase, setPhase] = useState<Phase>("scanning")
  const [error, setError] = useState<string | null>(null)
  const [product, setProduct] = useState<OFFProduct | null>(null)
  const [servings, setServings] = useState(1)
  const [meal, setMeal] = useState<MealKey>(targetForTime)
  const [logged, setLogged] = useState(false)
  const [manualCode, setManualCode] = useState("")
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const controlsRef = useRef<IScannerControls | null>(null)
  const lastCodeRef = useRef<string>("")
  const busyRef = useRef(false)

  const lookup = useCallback(async (code: string) => {
    if (busyRef.current) return
    busyRef.current = true
    setPhase("lookup")
    try {
      const res = await fetch(`/api/barcode?code=${encodeURIComponent(code)}`)
      const data = (await res.json().catch(() => null)) as { product?: OFFProduct; error?: string } | null
      if (data?.product) {
        setProduct(data.product)
        setServings(1)
        setLogged(false)
        setPhase("found")
      } else {
        setError(
          res.status === 404
            ? "Produit introuvable dans Open Food Facts — essaie un autre produit ou entre le code manuellement."
            : data?.error ?? "Recherche impossible pour le moment.",
        )
        setPhase("error")
      }
    } catch {
      setError("Connexion impossible — réessaie.")
      setPhase("error")
    } finally {
      busyRef.current = false
    }
  }, [])

  const stopScanner = useCallback(() => {
    controlsRef.current?.stop()
    controlsRef.current = null
  }, [])

  const startScanner = useCallback(async () => {
    setError(null)
    lastCodeRef.current = ""
    stopScanner() // never double-start the camera
    try {
      const reader = new BrowserMultiFormatReader()
      // Limite aux formats produits (plus rapide) + TRY_HARDER pour les codes peu contrastés
      const hints = new Map<DecodeHintType, unknown>()
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [
        BarcodeFormat.EAN_13,
        BarcodeFormat.EAN_8,
        BarcodeFormat.UPC_A,
        BarcodeFormat.UPC_E,
        BarcodeFormat.CODE_128,
      ])
      hints.set(DecodeHintType.TRY_HARDER, true)
      reader.setHints(hints as never)
      // Caméra ARRIÈRE obligatoire (selfie cam ne voit pas les codes) + focus continu
      let deviceId: string | undefined
      try {
        const devices = await BrowserMultiFormatReader.listVideoInputDevices()
        const backs = devices.filter((d) =>
          /back|rear|arrière|environment|camera 2|camera 0/i.test(d.label ?? ""),
        )
        deviceId = backs[0]?.deviceId ?? undefined
      } catch {
        // fallback: default device
      }
      const stream = deviceId
        ? await navigator.mediaDevices.getUserMedia({
            video: { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } },
          })
        : await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
          })
      try {
        const track = stream.getVideoTracks()[0]
        await track.applyConstraints({ advanced: [{ focusMode: "continuous" } as unknown as MediaTrackConstraintSet] }).catch(() => {})
      } catch {
        // focus control unsupported
      }
      const controls = await reader.decodeFromStream(stream, videoRef.current!, (result) => {
        if (!result) return
        const code = result.getText()
        if (code === lastCodeRef.current) return
        lastCodeRef.current = code
        void lookup(code)
      })
      controlsRef.current = controls
    } catch {
      setError("Caméra inaccessible. Autorise l'accès ou entre le code à la main.")
      setPhase("error")
    }
  }, [lookup, stopScanner])

  useEffect(() => {
    void startScanner()
    return () => stopScanner()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const backToScan = () => {
    setProduct(null)
    setError(null)
    setPhase("scanning")
    lastCodeRef.current = ""
    void startScanner()
  }

  /** Manual barcode entry with real validation (EAN-8, UPC-A, EAN-13). */
  const submitManual = () => {
    const code = manualCode.trim()
    if (!/^\d{8}$|^\d{12,13}$/.test(code)) {
      setManualError("Code invalide : 8, 12 ou 13 chiffres attendus.")
      return
    }
    setManualError("")
    void lookup(code)
  }
  const [manualError, setManualError] = useState("")

  const add = () => {
    if (!product) return
    addFood(meal, productToFood(product, servings))
    setLogged(true)
    window.setTimeout(onClose, 700)
  }

  const nutriscoreColor: Record<string, string> = {
    A: "bg-emerald-500",
    B: "bg-lime-500",
    C: "bg-yellow-500",
    D: "bg-orange-500",
    E: "bg-red-500",
  }

  return (
    <div className="safe-top fixed inset-0 z-50 flex flex-col bg-[#0b0f0d]/98 aurora-glow">
      {/* Header */}
      <header className="flex items-center justify-between px-5 pb-2 pt-4">
        <div>
          <h2 className="text-lg font-extrabold">
            {phase === "found" ? "Produit scanné" : "Scanner un code-barres"}
          </h2>
          <p className="text-xs text-muted-foreground">Base Open Food Facts · 3M+ produits</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close scanner"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-card active:scale-90"
        >
          <X className="h-5 w-5" />
        </button>
      </header>

      {/* Camera / result */}
      {phase === "found" && product ? (
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-4 no-scrollbar">
          <div className="flex items-start gap-4 rounded-3xl bg-card p-4 shadow-sm">
            {product.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={product.image} alt="" className="h-20 w-20 shrink-0 rounded-2xl object-cover" />
            ) : (
              <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-muted text-3xl">📦</span>
            )}
            <div className="min-w-0 flex-1">
              <p className="font-extrabold leading-tight">{product.name}</p>
              {product.brand && <p className="text-xs text-muted-foreground">{product.brand}</p>}
              <div className="mt-1.5 flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground">{product.serving}</span>
                {product.nutriscore && (
                  <span
                    className={cn(
                      "flex h-5 w-5 items-center justify-center rounded text-[11px] font-black text-white",
                      nutriscoreColor[product.nutriscore] ?? "bg-gray-500",
                    )}
                  >
                    {product.nutriscore}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Servings */}
          <div className="flex items-center justify-between rounded-2xl bg-card p-3">
            <span className="text-sm font-bold">Quantité</span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setServings((s) => Math.max(0.5, Math.round((s - 0.5) * 2) / 2))}
                aria-label="Less"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-muted active:scale-90"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="w-14 text-center text-base font-extrabold tabular-nums">
                {servings.toLocaleString("fr")} ×
              </span>
              <button
                type="button"
                onClick={() => setServings((s) => Math.min(9, Math.round((s + 0.5) * 2) / 2))}
                aria-label="More"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-muted active:scale-90"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Macros of what will be logged */}
          {(() => {
            const food = productToFood(product, servings)
            return (
              <div className="grid grid-cols-4 gap-2">
                <Macro label="kcal" value={food.calories} tone="bg-accent text-primary" />
                <Macro label="Protéines" value={food.protein} tone="bg-[#34d399]/15 text-[#34d399]" />
                <Macro label="Glucides" value={food.carbs} tone="bg-amber-400/15 text-amber-300" />
                <Macro label="Lipides" value={food.fat} tone="bg-rose-400/15 text-rose-300" />
              </div>
            )
          })()}

          {product.per100g && product.perServing && (
            <p className="text-center text-[11px] text-muted-foreground">
              Pour 100 g : {product.per100g.calories ?? "—"} kcal · P{product.per100g.protein ?? "—"} C
              {product.per100g.carbs ?? "—"} F{product.per100g.fat ?? "—"}
            </p>
          )}

          {/* Meal picker */}
          <div className="grid grid-cols-4 gap-2">
            {(Object.keys(mealMeta) as MealKey[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setMeal(key)}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-2xl border py-2.5 text-[11px] font-bold transition-all",
                  meal === key
                    ? "border-primary bg-primary/20 text-[#e6fff1]"
                    : "border-[#a7f3d0]/10 bg-card text-muted-foreground",
                )}
              >
                <span className="text-lg">{mealMeta[key].emoji}</span>
                {mealMeta[key].name}
              </button>
            ))}
          </div>

          {/* Actions */}
          <div className="mt-auto flex gap-3">
            <button
              type="button"
              onClick={backToScan}
              className="flex items-center justify-center gap-2 rounded-2xl bg-muted py-4 text-sm font-bold active:scale-[0.98]"
            >
              <ScanLine className="h-4 w-4" />
              Re-scan
            </button>
            <button
              type="button"
              onClick={add}
              disabled={logged}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-sm font-extrabold text-primary-foreground shadow-lg shadow-primary/30 transition-transform active:scale-[0.98]",
                logged && "opacity-70",
              )}
            >
              {logged ? <Check className="h-5 w-5" strokeWidth={3} /> : <Plus className="h-5 w-5" strokeWidth={2.5} />}
              {logged ? "Ajouté !" : "Ajouter au repas"}
            </button>
          </div>
        </div>
      ) : (
        <div className="relative flex-1 overflow-hidden">
          <video ref={videoRef} className="absolute inset-0 h-full w-full object-cover" muted playsInline autoPlay />
          {/* Frame overlay */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="relative h-40 w-72 max-w-[80%]">
              <div className="absolute inset-0 rounded-2xl border-2 border-[#34d399]/70 shadow-[0_0_30px_rgba(52,211,153,0.3)]" />
              <div className="absolute -left-1 -top-1 h-6 w-6 rounded-tl-2xl border-l-4 border-t-4 border-[#34d399]" />
              <div className="absolute -right-1 -top-1 h-6 w-6 rounded-tr-2xl border-r-4 border-t-4 border-[#34d399]" />
              <div className="absolute -bottom-1 -left-1 h-6 w-6 rounded-bl-2xl border-b-4 border-l-4 border-[#34d399]" />
              <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-br-2xl border-b-4 border-r-4 border-[#34d399]" />
              {phase === "scanning" && (
                <div className="absolute inset-x-3 top-1/2 h-0.5 animate-pulse rounded-full bg-[#34d399]/80" />
              )}
            </div>
          </div>
          <p className="absolute inset-x-0 bottom-32 text-center text-sm font-bold text-[#e6fff1] drop-shadow">
            {phase === "lookup" ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Recherche du produit…
              </span>
            ) : (
              "Tenez le code à 15-25 cm, cadre bien droit"
            )}
          </p>

          {error && (
            <div className="absolute inset-x-5 bottom-40 rounded-2xl border border-amber-400/40 bg-amber-400/10 p-4">
              <p className="flex items-start gap-2 text-sm font-semibold text-amber-300">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                {error}
              </p>
              <button
                type="button"
                onClick={backToScan}
                className="mt-2 w-full rounded-xl bg-amber-400/20 py-2 text-xs font-bold text-amber-200 active:scale-95"
              >
                Réessayer le scan
              </button>
            </div>
          )}

          {/* Manual entry */}
          <div className="absolute inset-x-5 bottom-10">
            <form
              onSubmit={(e) => {
                e.preventDefault()
                submitManual()
              }}
              className="flex flex-col gap-1.5"
            >
              <div className="flex gap-2">
                <input
                  value={manualCode}
                  onChange={(e) => {
                    setManualCode(e.target.value.replace(/\D/g, "").slice(0, 13))
                    setManualError("")
                  }}
                  inputMode="numeric"
                  placeholder="Code-barres manuel (ex : 3017620422003)"
                  className="flex-1 rounded-2xl bg-card px-4 py-3 text-sm font-medium outline-none placeholder:text-muted-foreground"
                />
                <button
                  type="submit"
                  aria-label="Lookup barcode"
                  className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary text-secondary-foreground active:scale-95"
                >
                  <BarChart3 className="h-5 w-5 text-primary" />
                </button>
              </div>
              {manualError && <p className="animate-fade-in text-xs font-bold text-amber-300">{manualError}</p>}
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function Macro({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className={cn("rounded-2xl p-3 text-center", tone)}>
      <p className="text-lg font-extrabold tabular-nums">{value}</p>
      <p className="text-[10px] font-bold uppercase tracking-wide opacity-80">{label}</p>
    </div>
  )
}
