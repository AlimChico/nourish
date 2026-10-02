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
  WifiOff,
  ServerCrash,
  PencilLine,
} from "lucide-react"
import { useFoodLog, type FoodItem, type MealKey } from "@/lib/food-log"
import {
  analyzeMealReal,
  itemBaseGrams,
  itemMacrosAt,
  makeScanThumbnail,
  ScanError,
  targetForTime,
  type ScanErrorKind,
  type ScanResult,
  type ScannedItem,
} from "@/lib/meal-scan"
import { mealMeta } from "@/lib/food-log"
import { cn } from "@/lib/utils"

type Phase = "capture" | "analyzing" | "review" | "nofood" | "unavailable"

/** Pas du réglage +/- de la portion, en grammes. */
const GRAM_STEP = 10
const MAX_GRAMS = 3000

/** Message affiché quand le scanner ne marche pas — un cas par cause réelle. */
const FAILURE_COPY: Record<ScanErrorKind, { title: string; body: string }> = {
  unavailable: {
    title: "Scanner indisponible",
    body: "Le moteur d'analyse ne répond pas pour le moment. Ta photo est gardée sur ton appareil — réessaie dans quelques minutes, ou saisis ton plat à la main.",
  },
  quota: {
    title: "Scanner saturé",
    body: "Le scanner a reçu trop de photos d'un coup et fait une pause. Réessaie dans quelques minutes : tes scans restent illimités, juste plus lents.",
  },
  offline: {
    title: "Pas de connexion",
    body: "Impossible de joindre le scanner : vérifie ta connexion (Wi-Fi ou données) puis relance l'analyse.",
  },
  noFood: {
    title: "No food detected",
    body: "We couldn't find any food in this photo. Frame the whole plate, add some light, and try again.",
  },
  badImage: {
    title: "Photo illisible",
    body: "La photo n'a pas pu être lue. Reprends-la ou choisis-en une autre dans ta galerie.",
  },
}

export function ScanMealScreen({ onClose }: { onClose: () => void }) {
  const { addFood } = useFoodLog()
  const [phase, setPhase] = useState<Phase>("capture")
  const [meal, setMeal] = useState<MealKey>(targetForTime)
  const [result, setResult] = useState<ScanResult | null>(null)
  const [kept, setKept] = useState<Record<number, boolean>>({})
  const [qtys, setQtys] = useState<Record<number, number>>({})
  // Grammes par item — pré-rempli avec l'estimation du scanner, corrigeable.
  const [grams, setGrams] = useState<Record<number, number>>({})
  const [thumbnail, setThumbnail] = useState<string | undefined>(undefined)
  // Miniature persistable : c'est elle qui reste sur le dashboard après « Log ».
  const [scanPhoto, setScanPhoto] = useState<string | undefined>(undefined)
  const [failure, setFailure] = useState<{ kind: ScanErrorKind; detail: string } | null>(null)
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

  /** Compresse une image data-URL : max 1024px, JPEG ~80% (≈200 Ko). */
  const downscale = useCallback(async (dataUrl: string): Promise<string> => {
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const i = new Image()
        i.onload = () => resolve(i)
        i.onerror = reject
        i.src = dataUrl
      })
      const side = Math.min(img.naturalWidth, img.naturalHeight, 1024)
      const canvas = document.createElement("canvas")
      canvas.width = side
      canvas.height = side
      const ctx = canvas.getContext("2d")
      if (!ctx) return dataUrl
      const sx = (img.naturalWidth - side) / 2
      const sy = (img.naturalHeight - side) / 2
      ctx.drawImage(img, sx, sy, side, side, 0, 0, side, side)
      return canvas.toDataURL("image/jpeg", 0.8)
    } catch {
      return dataUrl // compression impossible → on tente l'original
    }
  }, [])

  const capture = useCallback(() => {
    const video = videoRef.current
    let thumb: string | undefined
    try {
      if (video && video.videoWidth > 0) {
        const canvas = document.createElement("canvas")
        const side = Math.min(video.videoWidth, video.videoHeight, 1024)
        canvas.width = side
        canvas.height = side
        const ctx = canvas.getContext("2d")
        if (ctx) {
          const sx = (video.videoWidth - side) / 2
          const sy = (video.videoHeight - side) / 2
          ctx.drawImage(video, sx, sy, side, side, 0, 0, side, side)
          thumb = canvas.toDataURL("image/jpeg", 0.8)
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
    reader.onload = async () => {
      const raw = typeof reader.result === "string" ? reader.result : undefined
      if (!raw) return void runAnalysis(undefined)
      // Les photos de galerie font 3–6 Mo : Vercel rejette les bodies > ~4,5 Mo
      // et la 4G rame. On compresse localement (~200 Ko) avant l'envoi.
      const small = await downscale(raw)
      void runAnalysis(small)
    }
    reader.onerror = () => void runAnalysis(undefined)
    reader.readAsDataURL(file)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const runAnalysis = useCallback(async (thumb?: string) => {
    setThumbnail(thumb)
    stopCamera()
    setPhase("analyzing")
    setResult(null)
    setFailure(null)
    setError(null)
    // Miniature légère (~15 Ko) préparée tout de suite : elle sera attachée au
    // plat enregistré pour que la photo reste sur le dashboard.
    void makeScanThumbnail(thumb).then((p) => setScanPhoto(p))
    try {
      const r = await analyzeMealReal(thumb)
      setResult(r)
      setKept(Object.fromEntries(r.items.map((_, i) => [i, true])))
      setQtys(Object.fromEntries(r.items.map((_, i) => [i, r.items[i].quantity])))
      setGrams(Object.fromEntries(r.items.map((_, i) => [i, itemBaseGrams(r.items[i])])))
      setPhase("review")
    } catch (err) {
      if (err instanceof ScanError) {
        if (err.kind === "noFood") {
          // Photo sans aliment reconnu : état dédié (pas de liste vide).
          setPhase("nofood")
          return
        }
        // Scanner/IA/réseau en panne : on le DIT clairement, jamais de faux plat.
        setFailure({ kind: err.kind, detail: err.message })
        setPhase("unavailable")
        return
      }
      setFailure({ kind: "unavailable", detail: err instanceof Error ? err.message : "" })
      setPhase("unavailable")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const retake = useCallback(() => {
    setResult(null)
    setError(null)
    setFailure(null)
    setPhase("capture")
    void startCamera()
  }, [startCamera])

  /** Relance l'analyse sur la MÊME photo (le cas le plus fréquent : panne passagère). */
  const retryAnalysis = useCallback(() => {
    if (thumbnail) void runAnalysis(thumbnail)
    else retake()
  }, [thumbnail, runAnalysis, retake])

  const activeItems = result
    ? result.items.filter((_, i) => kept[i] !== false)
    : []

  // Totaux recalculés en direct à partir des grammes saisis par l'utilisateur
  // (et non plus du seul poids deviné par le scanner).
  const totals = result
    ? result.items.reduce(
        (acc, it, i) => {
          if (kept[i] === false) return acc
          const m = itemMacrosAt(it, grams[i] ?? it.grams, qtys[i] ?? it.quantity)
          return {
            calories: acc.calories + m.calories,
            protein: acc.protein + m.protein,
            carbs: acc.carbs + m.carbs,
            fat: acc.fat + m.fat,
          }
        },
        { calories: 0, protein: 0, carbs: 0, fat: 0 },
      )
    : { calories: 0, protein: 0, carbs: 0, fat: 0 }

  const saveAll = useCallback(() => {
    if (!result) return
    for (const it of activeItems) {
      const idx = result.items.indexOf(it)
      const qty = qtys[idx] ?? it.quantity
      const g = Math.round(grams[idx] ?? itemBaseGrams(it))
      // Macros pour le poids réellement saisi (×qty à l'enregistrement).
      const m = itemMacrosAt(it, g, 1)
      // Le libellé garde l'estimation du scanner tant que l'utilisateur n'a pas
      // changé le poids ; sinon on affiche le poids choisi (une seule fois ×qty).
      const edited = g !== itemBaseGrams(it)
      const food: FoodItem = {
        id: `scan_${it.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        name: `${it.name} (${edited ? `${g} g` : it.portion})`,
        serving: edited ? `${g} g` : it.portion,
        calories: Math.round(m.calories),
        protein: Math.round(m.protein),
        carbs: Math.round(m.carbs),
        fat: Math.round(m.fat),
        emoji: foodEmoji(it.name),
        // La photo du plat suit le plat enregistré : elle réapparaît sur le
        // dashboard (aujourd'hui) à côté des calories et des macros.
        photo: scanPhoto,
        scanned: true,
      }
      addFood(meal, food, qty)
    }
    onClose()
  }, [result, activeItems, qtys, grams, meal, addFood, onClose, scanPhoto])

  return (
    <div className="safe-top absolute inset-0 z-30 flex flex-col bg-background aurora-glow animate-slide-up">
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
              {phase === "nofood" && "No food detected"}
              {phase === "unavailable" && (failure ? FAILURE_COPY[failure.kind].title : "Scanner indisponible")}
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
      {phase === "unavailable" ? (
        /* ---------- Scanner indisponible : on le dit clairement ---------- */
        <div className="relative flex flex-1 flex-col overflow-hidden">
          {thumbnail && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={thumbnail}
              alt="Captured meal"
              className="absolute inset-0 h-full w-full scale-105 object-cover opacity-25 blur-[2px]"
            />
          )}
          <div className="relative flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center text-[#e6fff1]">
            <span className="flex h-16 w-16 items-center justify-center rounded-3xl bg-[#fbbf24]/15">
              {failure?.kind === "offline" ? (
                <WifiOff className="h-8 w-8 text-[#fbbf24]" />
              ) : (
                <ServerCrash className="h-8 w-8 text-[#fbbf24]" />
              )}
            </span>
            <p className="text-lg font-extrabold">
              {failure ? FAILURE_COPY[failure.kind].title : "Scanner indisponible"}
            </p>
            <p className="max-w-sm text-sm leading-relaxed text-[#e6fff1]/75">
              {failure ? FAILURE_COPY[failure.kind].body : FAILURE_COPY.unavailable.body}
            </p>
            {failure && failure.kind !== "badImage" && redundantDetail(failure) && (
              <p className="max-w-xs rounded-xl bg-[#a7f3d0]/8 px-3 py-2 text-[11px] leading-relaxed text-[#e6fff1]/45">
                {failure.detail}
              </p>
            )}
            <div className="mt-2 flex w-full max-w-xs flex-col gap-2">
              <button
                type="button"
                onClick={retryAnalysis}
                className="flex items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 text-sm font-extrabold text-primary-foreground active:scale-[0.98]"
              >
                <RotateCcw className="h-4 w-4" /> Réessayer l&apos;analyse
              </button>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex items-center justify-center gap-2 rounded-2xl border border-[#a7f3d0]/20 py-3 text-sm font-bold text-[#e6fff1]/85 active:scale-[0.98]"
              >
                <PencilLine className="h-4 w-4" /> Saisir / choisir une autre photo
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-2xl py-2.5 text-sm font-bold text-[#e6fff1]/60 active:scale-[0.98]"
              >
                Fermer
              </button>
            </div>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) onPickFile(f)
              e.target.value = ""
            }}
          />
        </div>
      ) : phase === "nofood" ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-secondary px-8 text-center text-[#e6fff1]">
          <span className="flex h-16 w-16 items-center justify-center rounded-3xl bg-[#a7f3d0]/10">
            <Camera className="h-8 w-8 text-[#e6fff1]/70" />
          </span>
          <p className="text-lg font-extrabold">No food detected</p>
          <p className="max-w-xs text-sm text-[#e6fff1]/70">
            We couldn&apos;t find any food in this photo. Frame the whole plate, add some light, and try again.
          </p>
          <div className="mt-2 flex w-full max-w-xs flex-col gap-2">
            <button
              type="button"
              onClick={retake}
              className="flex items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 text-sm font-extrabold text-primary-foreground active:scale-[0.98]"
            >
              <Camera className="h-4 w-4" /> Try again
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border border-[#a7f3d0]/20 py-3 text-sm font-bold text-[#e6fff1]/80 active:scale-[0.98]"
            >
              Close
            </button>
          </div>
        </div>
      ) : phase !== "review" ? (
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
                  grams={grams[i] ?? itemBaseGrams(it)}
                  onToggle={() => setKept((k) => ({ ...k, [i]: !(k[i] !== false) }))}
                  onQty={(q) => setQtys((s) => ({ ...s, [i]: q }))}
                  onGrams={(g) => setGrams((s) => ({ ...s, [i]: g }))}
                />
              ))}
            </div>

            {result && activeItems.length > 0 && <TotalsCard totals={totals} />}

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

/**
 * Le message technique du serveur est-il utile à afficher en plus du texte
 * grand public ? Non s'il dit déjà la même chose (on évite le doublon visible).
 */
function redundantDetail(failure: { kind: ScanErrorKind; detail: string } | null): string | undefined {
  if (!failure?.detail) return undefined
  if (failure.detail.length < 20) return undefined
  const norm = (s: string) => s.toLowerCase().replace(/[^a-zà-ÿ0-9]+/g, " ")
  const a = norm(failure.detail)
  const b = norm(FAILURE_COPY[failure.kind].body)
  if (a === b || a.includes(b) || b.includes(a)) return undefined
  return failure.detail
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
  grams,
  onToggle,
  onQty,
  onGrams,
}: {
  item: ScannedItem
  kept: boolean
  qty: number
  grams: number
  onToggle: () => void
  onQty: (q: number) => void
  onGrams: (g: number) => void
}) {
  // Champ de saisie local pour pouvoir effacer/réécrire pendant la frappe
  // (l'état parent reste numérique et clampé).
  const [gramsText, setGramsText] = useState(String(grams))
  useEffect(() => {
    setGramsText(String(grams))
  }, [grams])
  const macros = itemMacrosAt(item, grams, qty)
  const base = itemBaseGrams(item)
  const kcal = Math.round(macros.calories)
  // Le modèle renvoie high / medium / low : on l'affiche tel quel (couleur
  // dérivée du niveau) plutôt qu'un pourcentage trompeur.
  const confLevel = item.confidence >= 0.8 ? "high" : item.confidence >= 0.6 ? "medium" : "low"
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
            <span className={cn("text-xs font-bold capitalize", confColor)}>{confLevel} confidence</span>
            <span className="text-xs text-muted-foreground">·</span>
            <span className="text-xs font-bold tabular-nums">{kcal} kcal</span>
            {item.source === "local" && (
              <>
                <span className="text-xs text-muted-foreground">·</span>
                <span className="text-xs font-semibold text-steps">Base locale 🇹🇳</span>
              </>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onToggle}
          aria-label={kept ? `Exclude ${item.name}` : `Include ${item.name}`}
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors",
            kept ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
          )}
        >
          <Check className="h-4 w-4" strokeWidth={3} />
        </button>
      </div>

      {/* Poids de la portion : estimation du scanner, corrigeable au gramme. */}
      <div className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-muted/60 px-2.5 py-2">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onGrams(Math.max(1, grams - GRAM_STEP))}
            aria-label={`Reduce ${item.name} portion`}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-card active:scale-90"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <div className="flex items-baseline gap-1">
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={gramsText}
              onChange={(e) => {
                const digits = e.target.value.replace(/[^0-9]/g, "").slice(0, 4)
                setGramsText(digits)
                const n = parseInt(digits, 10)
                if (Number.isFinite(n) && n > 0) onGrams(Math.min(MAX_GRAMS, n))
              }}
              onBlur={() => setGramsText(String(grams))}
              aria-label={`${item.name} weight in grams`}
              className="w-14 rounded-lg bg-card px-2 py-1 text-center text-sm font-extrabold tabular-nums outline-none ring-primary focus:ring-2"
            />
            <span className="text-xs font-bold text-muted-foreground">g</span>
          </div>
          <button
            type="button"
            onClick={() => onGrams(Math.min(MAX_GRAMS, grams + GRAM_STEP))}
            aria-label={`Increase ${item.name} portion`}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-primary active:scale-90"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-bold text-muted-foreground">
            {grams !== base ? `AI: ${base} g` : "Portion"}
          </span>
          <button
            type="button"
            onClick={() => onQty(Math.max(1, qty - 1))}
            aria-label={`Decrease ${item.name} servings`}
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-card active:scale-90"
          >
            <Minus className="h-3 w-3" />
          </button>
          <span className="w-4 text-center text-xs font-extrabold tabular-nums">×{qty}</span>
          <button
            type="button"
            onClick={() => onQty(Math.min(9, qty + 1))}
            aria-label={`Increase ${item.name} servings`}
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-card active:scale-90"
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Macro mini-row — recalculée depuis le poids saisi */}
      <div className="mt-3 grid grid-cols-3 gap-2">
        <MacroChip label="P" value={Math.round(macros.protein)} className="bg-protein-soft text-protein" />
        <MacroChip label="C" value={Math.round(macros.carbs)} className="bg-carbs-soft text-carbs" />
        <MacroChip label="F" value={Math.round(macros.fat)} className="bg-fat-soft text-fat" />
      </div>

      {/* Transparence de la source : valeurs de référence pour 100 g. */}
      {item.per100 && (
        <p className="mt-2 text-[11px] font-medium text-muted-foreground">
          {item.reference ?? item.name} · réf. 100 g : {Math.round(item.per100.kcal)} kcal · P{" "}
          {Math.round(item.per100.protein)}g · C {Math.round(item.per100.carbs)}g · F{" "}
          {Math.round(item.per100.fat)}g
        </p>
      )}

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

function TotalsCard({ totals }: { totals: { calories: number; protein: number; carbs: number; fat: number } }) {
  const t = totals
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
