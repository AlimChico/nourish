"use client"

import { useEffect, useState } from "react"
import { Share, MoreVertical, MonitorSmartphone, ChevronDown, PlusSquare, Check, Download, Laptop, Apple } from "lucide-react"
import { cn } from "@/lib/utils"
import { ApkInstallCard } from "@/components/apk-install"
import { detectPlatform, isNativeApp, isStandalone, type Platform } from "@/lib/platform"

/**
 * "Install as an app" tutorial — shown in Profile.
 * Detects the visitor's platform and gives the exact tap-by-tap steps to add
 * Sahtek to the home screen (PWA). Collapses automatically once installed
 * (standalone display mode).
 *
 * Sur Android, la carte APK s'affiche au-dessus : le fichier d'installation est
 * la vraie app (notifications natives, aucune limite de navigateur), la PWA
 * reste proposée en dessous pour qui préfère ne rien télécharger.
 */

const Step = ({ n, children }: { n: number; children: React.ReactNode }) => (
  <li className="flex items-start gap-3">
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-black text-primary-foreground">
      {n}
    </span>
    {/* `text-muted-foreground` et non du blanc en dur : cette carte vit sur
        `bg-card`, qui devient clair en thème clair — du blanc y serait illisible. */}
    <span className="text-sm leading-relaxed text-muted-foreground">{children}</span>
  </li>
)

export function InstallGuide() {
  const [platform, setPlatform] = useState<Platform>("desktop")
  const [installed, setInstalled] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    setPlatform(detectPlatform())
    // Dans l'APK, l'app EST déjà installée : proposer de l'« ajouter à l'écran
    // d'accueil » n'aurait aucun sens. Seul l'iPhone et le navigateur affichent
    // les étapes d'installation.
    setInstalled(isStandalone() || isNativeApp())
  }, [])

  // Ne rend rien du tout (ni sur iPhone, ni dans l'APK, ni sur ordinateur).
  const apk = <ApkInstallCard />

  if (installed) {
    return (
      <div className="flex flex-col gap-4">
        {apk}
        <div className="flex items-center gap-3 rounded-2xl border border-[#a7f3d0]/15 bg-card p-4 shadow-sm">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/20 text-primary">
            <Check className="h-5 w-5" strokeWidth={3} />
          </span>
          <p className="flex-1 text-sm font-semibold text-muted-foreground">
            Sahtek est <span className="font-extrabold text-primary">installée</span> sur ton écran d&apos;accueil 🎉
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {apk}
      <section className="overflow-hidden rounded-2xl border border-[#a7f3d0]/15 bg-card shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 p-4 text-left active:bg-muted/30"
        aria-expanded={open}
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-primary">
          <MonitorSmartphone className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-extrabold">
            {platform === "android" ? "Version web — sans rien télécharger" : "Installer Sahtek comme une app"}
          </span>
          <span className="block text-xs text-muted-foreground">
            {platform === "ios" ? "Sur ton iPhone — 4 taps" : platform === "android" ? "Sur ton Android — 3 taps" : "Sur ton ordinateur — 2 clics"}
            {" · hors-ligne, plein écran, icône"}
          </span>
        </span>
        <ChevronDown className={cn("h-5 w-5 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="animate-fade-in border-t border-border px-4 pb-4 pt-3">
          {platform === "ios" && (
            <ol className="flex flex-col gap-3">
              <Step n={1}>
                Ouvre <b>sahtek</b> dans <b>Safari</b> <Share className="inline h-4 w-4 -translate-y-0.5 text-primary" /> — le bouton
                « Partager » en bas de l&apos;écran (le carré avec une flèche vers le haut).
              </Step>
              <Step n={2}>
                Fais défiler et tape <b>« Sur l&apos;écran d&apos;accueil »</b> <PlusSquare className="inline h-4 w-4 -translate-y-0.5 text-primary" />.
                <br />
                <span className="text-xs text-muted-foreground">Sur Chrome iPhone : menu ⋯ → « Ajouter aux favoris » ne suffit pas — utilise Safari.</span>
              </Step>
              <Step n={3}>
                Vérifie le nom (ex. <b>Sahtek</b>) puis tape <b>« Ajouter »</b> en haut à droite.
              </Step>
              <Step n={4}>
                L&apos;icône <Apple className="inline h-4 w-4 -translate-y-0.5 text-primary" /> verte apparaît sur ton écran d&apos;accueil —
                ouvre-la : plein écran, sans barre de navigateur, comme une vraie app 🎉
              </Step>
            </ol>
          )}

          {platform === "android" && (
            <ol className="flex flex-col gap-3">
              <Step n={1}>
                Ouvre <b>sahtek</b> dans <b>Chrome</b> — tape le menu <MoreVertical className="inline h-4 w-4 -translate-y-0.5 text-primary" /> (les 3 points, en haut à droite).
              </Step>
              <Step n={2}>
                Tape <b>« Ajouter à l&apos;écran d&apos;accueil »</b> (ou « Installer l&apos;application »).
              </Step>
              <Step n={3}>
                Confirme avec <b>« Ajouter »</b> — l&apos;icône verte est sur ton téléphone, l&apos;app s&apos;ouvre en plein écran 🎉
              </Step>
            </ol>
          )}

          {platform === "desktop" && (
            <ol className="flex flex-col gap-3">
              <Step n={1}>
                <b>Chrome / Edge</b> : clique l&apos;icône <Download className="inline h-4 w-4 -translate-y-0.5 text-primary" /> « Installer »
                dans la barre d&apos;adresse (à droite), ou menu ⋮ → « Installer Sahtek ».
              </Step>
              <Step n={2}>
                <b>Safari Mac</b> : menu <Laptop className="inline h-4 w-4 -translate-y-0.5 text-primary" /> File → « Open in Dock ».
                <br />
                L&apos;app s&apos;ouvre dans sa propre fenêtre, sans navigateur 🎉
              </Step>
            </ol>
          )}

          <p className="mt-4 rounded-xl bg-muted/60 p-3 text-[11px] leading-relaxed text-muted-foreground">
            💡 Une fois installée : <b>plein écran</b> (pas de barre d&apos;adresse), <b>caméra du téléphone</b> pour scanner les
            code-barres, <b>notifications</b> activables, et l&apos;app fonctionne même <b>sans connexion</b>.
          </p>

          <button
            type="button"
            onClick={() => setOpen(false)}
            className="mt-3 w-full rounded-xl bg-muted py-2 text-xs font-bold text-muted-foreground active:scale-95"
          >
            Fermer
          </button>
        </div>
      )}
      </section>
    </div>
  )
}
