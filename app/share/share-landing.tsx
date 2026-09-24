"use client"

import { useEffect, useState } from "react"

type Payload = {
  kind: "app" | "recipe" | "progress"
  title?: string
  name?: string
  calories?: number
  protein?: number
  carbs?: number
  fat?: number
  streak?: number
  emoji?: string
}

function readPayload(): Payload {
  try {
    const p = new URLSearchParams(window.location.search)
    const kind = (p.get("kind") as Payload["kind"]) || "app"
    return {
      kind,
      title: p.get("title") || undefined,
      name: p.get("name") || undefined,
      calories: num(p.get("calories")),
      protein: num(p.get("protein")),
      carbs: num(p.get("carbs")),
      fat: num(p.get("fat")),
      streak: num(p.get("streak")),
      emoji: p.get("emoji") || "🥗",
    }
  } catch {
    return { kind: "app", emoji: "🥗" }
  }
}

function num(v: string | null): number | undefined {
  const n = v === null ? NaN : Number(v)
  return isFinite(n) ? n : undefined
}

/**
 * Landing publique des liens de partage : présente l'app, montre les chiffres
 * partagés, et pousse vers l'installation (PWA) ou la création de compte.
 */
export function ShareLanding() {
  const [data, setData] = useState<Payload | null>(null)
  const [deferred, setDeferred] = useState<{ prompt: () => Promise<void> } | null>(null)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    setData(readPayload())
    setInstalled(window.matchMedia("(display-mode: standalone)").matches)
    const onBip = (e: Event) => {
      e.preventDefault()
      setDeferred(e as unknown as { prompt: () => Promise<void> })
    }
    window.addEventListener("beforeinstallprompt", onBip)
    return () => window.removeEventListener("beforeinstallprompt", onBip)
  }, [])

  const inviter = data?.name ? decodeURIComponent(data.name) : null
  const isRecipe = data?.kind === "recipe"
  const isProgress = data?.kind === "progress"

  const install = async () => {
    if (deferred) {
      await deferred.prompt()
      return
    }
    // iOS / pas de BIP → onboarding avec création de compte
    window.location.href = "/?onboard=1"
  }

  return (
    <main className="aurora-bg flex min-h-dvh flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-md rounded-[2rem] bg-[#0b0f0d]/90 p-7 text-center shadow-2xl ring-1 ring-[#a7f3d0]/10 backdrop-blur">
        <span className="text-5xl">{data?.emoji ?? "🥗"}</span>
        <h1 className="mt-3 text-2xl font-black tracking-tight text-[#e6fff1]">
          {isRecipe
            ? "Une recette partagée depuis Sahtek"
            : isProgress
              ? `${inviter ?? "Un ami"} partage son parcours`
              : "Rejoins-moi sur Sahtek 🇹🇳"}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-[#8fb5a3]">
          {isRecipe
            ? `${data?.title ?? "Recette healthy"} — ${data?.calories ?? "?"} kcal · P${data?.protein ?? "?"} C${data?.carbs ?? "?"} F${data?.fat ?? "?"}. Crée ton compte pour l'ajouter à ton journal !`
            : isProgress
              ? `🔥 ${data?.streak ?? 0} jours de streak, objectif nutrition en cours. Crée ton programme perso en 2 minutes.`
              : `${inviter ?? "Un ami"} t'invite à suivre tes calories, scanner tes plats tunisiens et devenir une version plus saine de toi-même.`}
        </p>

        {/* Preview des features — ce que le nouvel utilisateur va obtenir */}
        <div className="mt-6 grid grid-cols-3 gap-2 text-[11px] font-bold text-[#cfe8db]">
          {[
            { e: "📷", t: "Scan repas IA" },
            { e: "🇹🇳", t: "Coach derja" },
            { e: "🔥", t: "Défis & badges" },
          ].map((f) => (
            <div key={f.t} className="rounded-2xl bg-[#0f1f17] p-3 ring-1 ring-[#a7f3d0]/10">
              <span className="text-xl">{f.e}</span>
              <p className="mt-1">{f.t}</p>
            </div>
          ))}
        </div>

        <div className="mt-7 flex flex-col gap-3">
          {!installed && (
            <button
              type="button"
              onClick={() => void install()}
              className="rounded-2xl bg-emerald-500 py-4 text-base font-extrabold text-[#06130c] shadow-lg shadow-emerald-500/30 transition-transform active:scale-[0.98]"
            >
              📲 Installer l&apos;app gratuitement
            </button>
          )}
          <a
            href="/?onboard=1"
            className="rounded-2xl bg-[#0a3d2e] py-4 text-base font-extrabold text-[#d9fbe8] ring-1 ring-[#a7f3d0]/15 transition-transform active:scale-[0.98]"
          >
            Créer mon programme personnalisé
          </a>
          {installed && (
            <a href="/" className="text-sm font-bold text-emerald-400">
              Ouvrir l&apos;app →
            </a>
          )}
        </div>

        <p className="mt-5 text-[11px] text-[#5f7a6d]">
          Gratuit · Sans pub dans les zones de saisie · Tes données restent les tiennes
        </p>
      </div>

      <a href="/privacy" className="mt-6 text-xs font-semibold text-[#5f7a6d]">
        Politique de confidentialité
      </a>
    </main>
  )
}
