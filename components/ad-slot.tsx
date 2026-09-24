"use client"

import { useEffect, useRef } from "react"
import { usePremium } from "@/lib/premium"
import { cn } from "@/lib/utils"

/**
 * Reusable ad slot — Google AdSense ready.
 *
 * Rules enforced by design:
 *  - Premium users NEVER see ads (renders nothing).
 *  - Nothing here can block or delay the user's main action: the ad container
 *    is a fixed-height placeholder that fills asynchronously.
 *  - `format` is a logical name ("banner" | "inline" | "footer"), mapped to
 *    responsive ad units. Swap ADS_* constants to go live — no UI redesign.
 *
 * Adsense client is injected once per page by <AdSenseScript /> (layout).
 */

export const ADSENSE_CLIENT = "ca-pub-4994351868321038"

/** Logical slot ids per placement — replace with real AdSense ad-unit ids after approval. */
export const AD_SLOTS = {
  homeBanner: "0000000001",
  foodResults: "0000000002",
  progressFooter: "0000000003",
} as const

export type AdFormat = "banner" | "inline" | "footer"

const FORMAT_STYLE: Record<AdFormat, React.CSSProperties> = {
  banner: { display: "block", minHeight: 90 },
  inline: { display: "block", minHeight: 100 },
  footer: { display: "block", minHeight: 100 },
}

declare global {
  interface Window {
    adsbygoogle?: unknown[]
  }
}

export function AdSlot({
  slot,
  format = "banner",
  label = "Publicité",
  className,
}: {
  slot: string
  format?: AdFormat
  label?: string
  className?: string
}) {
  const { isPremium, hydrated } = usePremium()
  const pushed = useRef(false)

  useEffect(() => {
    if (isPremium || !hydrated) return
    if (pushed.current) return
    try {
      // AdSense fills the ins asynchronously; errors are silently ignored until
      // the account is approved (unfilled slots stay as subtle placeholders).
      ;(window.adsbygoogle = window.adsbygoogle || []).push({})
      pushed.current = true
    } catch {
      // script blocked (adblocker / not yet approved) — placeholder remains
    }
  }, [isPremium, hydrated])

  // Premium: never render anything at all.
  if (!hydrated || isPremium) return null

  return (
    <aside
      aria-label={label}
      className={cn("relative overflow-hidden rounded-2xl border border-[#a7f3d0]/10 bg-card/60", className)}
    >
      <span className="absolute left-2 top-1.5 z-10 text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60">
        {label}
      </span>
      {/* Reserves layout space so nothing jumps when the ad fills */}
      <ins
        className="adsbygoogle"
        style={FORMAT_STYLE[format]}
        data-ad-client={ADSENSE_CLIENT}
        data-ad-slot={slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
      {/* Placeholder shown until AdSense fills the unit */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <p className="mt-3 px-4 text-center text-[11px] text-muted-foreground/40">
          Espace partenaire — soutient Sahtek gratuitement 💚
        </p>
      </div>
    </aside>
  )
}

/** Loads the AdSense script once per document. No-op when blocked. */
export function AdSenseScript() {
  useEffect(() => {
    if (document.querySelector("script[data-adsense='1']")) return
    const s = document.createElement("script")
    s.async = true
    s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`
    s.crossOrigin = "anonymous"
    s.setAttribute("data-adsense", "1")
    document.head.appendChild(s)
  }, [])
  return null
}
