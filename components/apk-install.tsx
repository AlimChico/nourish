"use client"

import { useEffect, useState } from "react"
import { ChevronDown, Download, Info, ShieldAlert, Smartphone } from "lucide-react"
import { APK_FILENAME, APK_URL, formatSize, useApk } from "@/lib/apk"
import { shouldOfferApk } from "@/lib/platform"
import { cn } from "@/lib/utils"

/**
 * Installation de l'app Android (APK).
 *
 * Visible UNIQUEMENT sur Android dans un navigateur : sur iPhone l'APK n'existe
 * pas, et dans l'APK lui-même (ou dans la PWA déjà installée) proposer de
 * télécharger l'app n'aurait aucun sens. C'est aussi ce qui évite de promettre
 * un fichier aux visiteurs desktop, qui ne sauraient pas quoi en faire.
 *
 * Le corps du téléchargement d'un APK est réglementé par Android lui-même, pas
 * par nous : le navigateur télécharge, puis le système demande l'autorisation
 * d'installer une app hors Play Store. La carte explique ce passage à l'avance,
 * parce que c'est là que la plupart des gens abandonnent.
 */
export function ApkInstallCard() {
  const apk = useApk()
  const [android, setAndroid] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    setAndroid(shouldOfferApk())
  }, [])

  if (!android) return null

  const size = formatSize(apk.size)

  return (
    <section className="overflow-hidden rounded-2xl border border-primary/30 bg-card shadow-sm">
      <div className="flex items-start gap-3 p-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Smartphone className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-extrabold">
            App Android <span className="text-primary">(.apk)</span>
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            {apk.status === "ready"
              ? "Le vrai fichier d'installation — icône sur ton écran d'accueil, hors-ligne, notifications."
              : apk.status === "checking"
                ? "Vérification de la disponibilité…"
                : "La version Android n'est pas encore publiée sur ce serveur."}
          </p>
        </div>
      </div>

      <div className="px-4 pb-4">
        {apk.status === "ready" ? (
          <a
            href={APK_URL}
            download={APK_FILENAME}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-extrabold text-primary-foreground active:scale-[0.98]"
          >
            <Download className="h-4 w-4" />
            Télécharger l&apos;APK
            {size && <span className="font-bold opacity-80">· {size}</span>}
          </a>
        ) : (
          <div
            className={cn(
              "flex items-center justify-center gap-2 rounded-xl border border-dashed py-3 text-sm font-bold",
              apk.status === "checking"
                ? "border-border text-muted-foreground"
                : "border-destructive/40 text-destructive",
            )}
          >
            {apk.status === "checking" ? (
              "Recherche du fichier…"
            ) : (
              <>
                <ShieldAlert className="h-4 w-4" />
                APK introuvable pour le moment
              </>
            )}
          </div>
        )}

        {apk.status === "missing" && (
          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
            En attendant, la version web s&apos;installe en 3 taps depuis les étapes ci-dessous : elle marche déjà
            hors-ligne et en plein écran.
          </p>
        )}

        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="mt-3 flex w-full items-center justify-center gap-1.5 text-xs font-bold text-primary"
          aria-expanded={open}
        >
          Comment l&apos;installer ?
          <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
        </button>
      </div>

      {open && (
        <div className="animate-fade-in border-t border-border px-4 pb-4 pt-3">
          <ol className="flex flex-col gap-3">
            <ApkStep n={1}>
              Tape <b>Télécharger l&apos;APK</b> ci-dessus. Chrome enregistre{" "}
              <b>{APK_FILENAME}</b> — suis la flèche de téléchargement en haut de l&apos;écran.
            </ApkStep>
            <ApkStep n={2}>
              Ouvre le fichier depuis la <b>notification</b>, ou via <b>Fichiers → Téléchargements</b>.
            </ApkStep>
            <ApkStep n={3}>
              Android prévient que l&apos;installation d&apos;apps inconnues est bloquée : tape{" "}
              <b>Paramètres</b>, active <b>« Autoriser cette source »</b> pour Chrome, puis reviens en arrière.
            </ApkStep>
            <ApkStep n={4}>
              Tape <b>Installer</b>. Si Play Protect propose <b>« Envoyer pour analyse »</b>, choisis{" "}
              <b>« Installer quand même »</b> — tu as téléchargé l&apos;app directement depuis Sahtek.
            </ApkStep>
            <ApkStep n={5}>
              L&apos;icône verte <Smartphone className="inline h-4 w-4 -translate-y-0.5 text-primary" /> apparaît dans
              tes apps 🎉 Connecte-toi avec le même compte : ton journal et ton historique sont déjà là.
            </ApkStep>
          </ol>

          <p className="mt-4 flex gap-2 rounded-xl bg-muted/60 p-3 text-[11px] leading-relaxed text-muted-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              Mises à jour : l&apos;app charge toujours la dernière version depuis le serveur, tu n&apos;as donc rien à
              réinstaller à chaque nouveauté. Tu ne retélécharges l&apos;APK que si on te le demande explicitement.
            </span>
          </p>
        </div>
      )}
    </section>
  )
}

function ApkStep({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-black text-primary-foreground">
        {n}
      </span>
      <span className="text-sm leading-relaxed">{children}</span>
    </li>
  )
}
