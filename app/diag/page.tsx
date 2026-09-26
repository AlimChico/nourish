"use client"

import { useEffect, useState } from "react"
import { RefreshCw } from "lucide-react"

type Info = {
  ua: string
  engine: string
  theme: string
  innerH: number
  outerH: number
  dvhSupport: boolean
  svhSupport: boolean
  safeTop: number
  safeBottom: number
  htmlBg: string
  themeColor: string
  viewportFit: string
  bodyScrollable: boolean
  mainExists: boolean
  mainScrollable: boolean
  navFixed: boolean
  navTop: number
  gapBelow: number
}

const LIGHT_BG = "#f2faf6"
const DARK_BG = "#0b0f0d"

function supports(css: string): boolean {
  return window.CSS?.supports?.(css) ?? false
}

export default function DiagPage() {
  const [info, setInfo] = useState<Info | null>(null)
  const [round, setRound] = useState(0)
  const [sw, setSw] = useState<{ displayMode: string; caches: string[]; controlled: boolean } | null>(null)
  const [updating, setUpdating] = useState(false)

  // Mode d'affichage (standalone = installée), caches SW et contrôleurs.
  useEffect(() => {
    const dm = (() => {
      for (const m of ["standalone", "fullscreen", "minimal-ui"]) {
        if (window.matchMedia(`(display-mode: ${m})`).matches) return m
      }
      return "browser"
    })()
    const load = async () => {
      const keys = window.caches ? await caches.keys() : []
      setSw({ displayMode: dm, caches: keys, controlled: "serviceWorker" in navigator && !!navigator.serviceWorker.controller })
    }
    void load()
  }, [round])

  // Purge totale : désinscrit les SW, supprime TOUS les caches, recharge.
  const forceUpdate = async () => {
    setUpdating(true)
    try {
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations()
        await Promise.all(regs.map((r) => r.unregister()))
      }
      if (window.caches) {
        const keys = await caches.keys()
        await Promise.all(keys.map((k) => caches.delete(k)))
      }
    } catch {
      // on recharge quoi qu'il arrive
    }
    window.location.reload()
  }

  useEffect(() => {
    const measure = () => {
      const root = document.documentElement
      const main = document.querySelector("main")
      const nav = document.querySelector('nav[aria-label="Main navigation"]')
      const navStyle = nav ? getComputedStyle(nav.parentElement!) : null
      const cs = getComputedStyle(root)
      const safeTop = cs.getPropertyValue("--sat") || "0px"
      setInfo({
        ua: navigator.userAgent,
        engine: /AppleWebKit/.test(navigator.userAgent) && /Version\//.test(navigator.userAgent) ? "Safari/WebKit" : /Chrome/.test(navigator.userAgent) ? "Blink (Chrome/Edge)" : /Firefox/.test(navigator.userAgent) ? "Gecko (Firefox)" : "Autre",
        theme: root.classList.contains("dark") ? "sombre" : "clair",
        innerH: window.innerHeight,
        outerH: window.outerHeight || 0,
        dvhSupport: supports("(height: 100dvh)"),
        svhSupport: supports("(height: 100svh)"),
        safeTop: parseFloat(cs.getPropertyValue("env(safe-area-inset-top)") || "0") || (window.visualViewport ? 0 : 0),
        safeBottom: 0,
        htmlBg: cs.backgroundColor,
        themeColor: document.querySelector('meta[name="theme-color"]')?.getAttribute("content") ?? "absente",
        viewportFit: document.querySelector('meta[name="viewport"]')?.getAttribute("content") ?? "absente",
        bodyScrollable: document.body.scrollHeight > window.innerHeight,
        mainExists: !!main,
        mainScrollable: main ? main.scrollHeight > main.clientHeight : false,
        navFixed: navStyle?.position === "fixed",
        navTop: nav ? Math.round(nav.getBoundingClientRect().top) : -1,
        gapBelow: nav ? Math.round(window.innerHeight - nav.getBoundingClientRect().bottom) : -1,
      })
    }
    measure()
    window.addEventListener("resize", measure)
    return () => window.removeEventListener("resize", measure)
  }, [round])

  const Row = ({ label, value, ok }: { label: string; value: string; ok?: boolean }) => (
    <div className="flex items-center justify-between gap-3 border-b border-border/60 py-2.5">
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      <span className={`text-right text-xs font-bold tabular-nums ${ok === undefined ? "" : ok ? "text-primary" : "text-destructive"}`}>
        {value}
      </span>
    </div>
  )

  return (
    <div className="min-h-dvh overflow-y-auto bg-background px-5 pt-[calc(env(safe-area-inset-top,0px)+1rem)] pb-[calc(env(safe-area-inset-bottom,0px)+2.5rem)]">
      <div className="mx-auto max-w-md">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-black tracking-tight">Diagnostic mobile</h1>
          <button
            type="button"
            onClick={() => setRound((r) => r + 1)}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-primary active:scale-90"
            aria-label="Re-mesurer"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Ouvre cette page sur ton téléphone pour vérifier l&apos;installation en direct.
        </p>

        {sw && (
          <div className="mt-5 rounded-2xl border border-border bg-card p-4">
            <Row label="Mode d&apos;affichage" value={sw.displayMode} ok={sw.displayMode !== "browser"} />
            <Row label="Cache service worker" value={sw.caches.length ? sw.caches.join(", ") : "aucun"} ok={sw.caches.some((c) => c.includes("v9"))} />
            <Row label="Contrôleur SW actif" value={sw.controlled ? "oui" : "non"} ok={sw.controlled} />
          </div>
        )}
        <button
          type="button"
          onClick={() => void forceUpdate()}
          disabled={updating}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-accent py-3 text-sm font-extrabold text-primary active:scale-[0.98] disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${updating ? "animate-spin" : ""}`} />
          {updating ? "Mise à jour…" : "Forcer la mise à jour (purge le cache)"}
        </button>

        {info && (
          <div className="mt-5 rounded-2xl border border-border bg-card p-4">
            <Row label="Moteur détecté" value={info.engine} />
            <Row label="Thème actif" value={info.theme} />
            <Row label="Fond html/body" value={info.htmlBg} ok />
            <Row label="meta theme-color" value={info.themeColor} ok={info.themeColor.includes("#0b0f0d") || info.themeColor.includes("#f2faf6")} />
            <Row label="viewport-fit" value={info.viewportFit.includes("viewport-fit=cover") ? "cover ✓" : info.viewportFit} ok={info.viewportFit.includes("viewport-fit=cover")} />
            <Row label="Hauteur fenêtre" value={`${info.innerH}px${info.outerH ? ` (ext ${info.outerH})` : ""}`} />
            <Row label="Support dvh / svh" value={`${info.dvhSupport ? "oui" : "non"} / ${info.svhSupport ? "oui" : "non"}`} />
          </div>
        )}

        {/* Zones safe-area visualisées : elles doivent être exactement de la couleur du fond */}
        <div className="mt-4 overflow-hidden rounded-2xl border border-border">
          <div className="h-10 bg-[var(--background)]" style={{ paddingTop: "env(safe-area-inset-top,0px)" }}>
            <p className="text-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              zone système haut (doit être invisible)
            </p>
          </div>
          <div className="flex h-24 items-center justify-center bg-card text-xs font-bold">
            contenu de l&apos;app
          </div>
          <div className="h-10 bg-[var(--background)]" style={{ paddingBottom: "env(safe-area-inset-bottom,0px)" }}>
            <p className="flex h-full items-end justify-center pb-1 text-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              zone système bas (doit être invisible)
            </p>
          </div>
        </div>

        <a
          href="/"
          className="mt-4 flex items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 text-sm font-extrabold text-primary-foreground active:scale-[0.98]"
        >
          Ouvrir l&apos;app pour tester le scroll
        </a>

        <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
          Si les deux zones ci-dessus se confondent avec le fond, le rendu natif est correct. Reviens en arrière ou
          visite <b>/</b> pour tester l&apos;app.
        </p>
      </div>
    </div>
  )
}
