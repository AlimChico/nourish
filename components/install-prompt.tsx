"use client"

import { useEffect, useState } from "react"
import { Download, X, Share, PlusSquare, MoreVertical } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Auto install prompt — fires shortly after the app opens:
 *  - Chromium/Android: shows the native `beforeinstallprompt` dialog.
 *  - iOS Safari (no native event): shows a small dismissible banner with the
 *    tap-by-tap steps. Never shown twice per device (localStorage), and never
 *    when already installed (standalone mode).
 */

const DISMISS_KEY = "sahtek.install.dismissed"
const DISMISS_DAYS = 14

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }

function isStandalone(): boolean {
  if (typeof window === "undefined") return false
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  )
}

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && "ontouchend" in document)
}

function recentlyDismissed(): boolean {
  try {
    const raw = window.localStorage.getItem(DISMISS_KEY)
    if (!raw) return false
    return Date.now() - Number(raw) < DISMISS_DAYS * 24 * 3600 * 1000
  } catch {
    return false
  }
}

export function InstallPrompt() {
  const [bipEvent, setBipEvent] = useState<BIPEvent | null>(null)
  const [showIOS, setShowIOS] = useState(false)
  const [iosOpen, setIosOpen] = useState(false)

  useEffect(() => {
    if (isStandalone() || recentlyDismissed()) return
    const onBip = (e: Event) => {
      e.preventDefault()
      setBipEvent(e as BIPEvent)
    }
    window.addEventListener("beforeinstallprompt", onBip)
    // Native dialog only exists on Chromium; on iOS we show our own banner.
    const t = window.setTimeout(() => {
      if (!isStandalone() && !recentlyDismissed() && isIOS()) setShowIOS(true)
    }, 2500)
    return () => {
      window.removeEventListener("beforeinstallprompt", onBip)
      window.clearTimeout(t)
    }
  }, [])

  const dismiss = () => {
    try {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now()))
    } catch {
      // storage unavailable
    }
    setBipEvent(null)
    setShowIOS(false)
  }

  const nativeInstall = async () => {
    if (!bipEvent) return
    await bipEvent.prompt()
    const choice = await bipEvent.userChoice
    if (choice.outcome === "accepted") dismiss()
  }

  if (!bipEvent && !showIOS) return null

  return (
    <>
      {/* Native Chromium/Android install dialog */}
      {bipEvent && (
        <div className="animate-slide-up fixed inset-x-3 bottom-24 z-50 mx-auto max-w-md rounded-3xl border border-[#a7f3d0]/15 bg-[#0d1a13]/95 p-4 shadow-[0_16px_50px_rgba(0,0,0,0.6)] backdrop-blur-xl">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
              <Download className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-extrabold">Installer Sahtek ?</p>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                Plein écran, hors-ligne, notifications — comme une vraie app, pas un site.
              </p>
            </div>
            <button
              type="button"
              onClick={dismiss}
              aria-label="Ne plus afficher"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground active:scale-90"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={dismiss}
              className="flex-1 rounded-xl bg-muted py-2.5 text-xs font-bold text-muted-foreground active:scale-95"
            >
              Plus tard
            </button>
            <button
              type="button"
              onClick={() => void nativeInstall()}
              className="flex-1 rounded-xl bg-primary py-2.5 text-xs font-extrabold text-primary-foreground active:scale-95"
            >
              Installer
            </button>
          </div>
        </div>
      )}

      {/* iOS banner (no native prompt available on Safari) */}
      {showIOS && !bipEvent && (
        <div className="animate-slide-up fixed inset-x-3 bottom-24 z-50 mx-auto max-w-md overflow-hidden rounded-3xl border border-[#a7f3d0]/15 bg-[#0d1a13]/95 shadow-[0_16px_50px_rgba(0,0,0,0.6)] backdrop-blur-xl">
          <button
            type="button"
            onClick={() => setIosOpen((o) => !o)}
            className="flex w-full items-start gap-3 p-4 text-left"
            aria-expanded={iosOpen}
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
              <Download className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-extrabold">Mets Sahtek sur ton écran d&apos;accueil</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                Plein écran + notifications, comme une vraie app — 4 taps.
              </span>
            </span>
            <span
              role="button"
              tabIndex={0}
              aria-label="Ne plus afficher"
              onClick={(e) => {
                e.stopPropagation()
                dismiss()
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.stopPropagation()
                  dismiss()
                }
              }}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground"
            >
              <X className="h-4 w-4" />
            </span>
          </button>
          {iosOpen && (
            <ol className="animate-fade-in flex flex-col gap-2 border-t border-border px-4 py-3 text-xs text-[#e6fff1]/85">
              <li className="flex items-center gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-black text-primary-foreground">1</span>
                Ouvre ce site dans <b>Safari</b> puis tape <Share className="inline h-4 w-4 text-primary" />
              </li>
              <li className="flex items-center gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-black text-primary-foreground">2</span>
                Choisis <b>« Sur l&apos;écran d&apos;accueil »</b> <PlusSquare className="inline h-4 w-4 text-primary" />
              </li>
              <li className="flex items-center gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-black text-primary-foreground">3</span>
                Tape <b>« Ajouter »</b> — l&apos;icône verte apparaît 🎉
              </li>
            </ol>
          )}
          {!iosOpen && (
            <div className="flex items-center gap-2 px-4 pb-3">
              <MoreVertical className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[11px] text-muted-foreground">Tape pour voir les étapes</span>
            </div>
          )}
        </div>
      )}
    </>
  )
}
