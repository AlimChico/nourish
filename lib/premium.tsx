"use client"

import { createContext, useContext, useEffect, useMemo, useState } from "react"

export type PremiumPlan = "monthly" | "yearly"

export type PremiumState = {
  plan: PremiumPlan | null
  since: string | null
  cardLast4: string | null
  renews: string | null
  cancelAt: string | null
}

export const FREE_SCANS_PER_DAY = 3

const STORAGE_KEY = "nourish.premium.v1"

function todayKey(now = new Date()): string {
  return now.toISOString().slice(0, 10)
}

function addMonths(iso: string, months: number): string {
  const d = new Date(iso + "T00:00:00")
  d.setMonth(d.getMonth() + months)
  return d.toISOString().slice(0, 10)
}

function defaultState(): PremiumState {
  return { plan: null, since: null, cardLast4: null, renews: null, cancelAt: null }
}

function normalize(raw: unknown): PremiumState {
  const base = defaultState()
  if (!raw || typeof raw !== "object") return base
  const s = raw as Partial<PremiumState>
  if (s.plan !== "monthly" && s.plan !== "yearly") return base
  return {
    plan: s.plan,
    since: typeof s.since === "string" ? s.since : null,
    cardLast4: typeof s.cardLast4 === "string" ? s.cardLast4 : null,
    renews: typeof s.renews === "string" ? s.renews : null,
    cancelAt: typeof s.cancelAt === "string" ? s.cancelAt : null,
  }
}

type PremiumStore = {
  premium: PremiumState
  isPremium: boolean
  hydrated: boolean
  scansUsedToday: number
  freeScansLeft: number
  subscribe: (plan: PremiumPlan, cardLast4: string) => void
  cancel: () => void
  resume: () => void
  consumeScan: () => void
}

const PremiumContext = createContext<PremiumStore | null>(null)

export function PremiumProvider({ children }: { children: React.ReactNode }) {
  const [premium, setPremium] = useState<PremiumState>(defaultState)
  const [hydrated, setHydrated] = useState(false)
  const [scanLog, setScanLog] = useState<Record<string, number>>({})

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as { premium?: unknown; scanLog?: unknown }
        setPremium(normalize(parsed.premium))
        if (parsed.scanLog && typeof parsed.scanLog === "object") {
          const today = todayKey()
          const log = parsed.scanLog as Record<string, number>
          setScanLog(Object.prototype.hasOwnProperty.call(log, today) ? { [today]: log[today] } : {})
        }
      }
    } catch {
      // corrupted storage — start fresh
    }
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ premium, scanLog }))
    } catch {
      // storage unavailable — keep in-memory
    }
  }, [premium, scanLog, hydrated])

  const store = useMemo<PremiumStore>(() => {
    const today = todayKey()
    const scansUsedToday = scanLog[today] ?? 0
    return {
      premium,
      isPremium: premium.plan !== null && premium.cancelAt === null,
      hydrated,
      scansUsedToday,
      freeScansLeft: Math.max(0, FREE_SCANS_PER_DAY - scansUsedToday),
      subscribe: (plan, cardLast4) =>
        setPremium({
          plan,
          since: todayKey(),
          cardLast4,
          renews: addMonths(todayKey(), plan === "yearly" ? 12 : 1),
          cancelAt: null,
        }),
      cancel: () =>
        setPremium((p) => (p.plan ? { ...p, cancelAt: p.renews ?? todayKey() } : p)),
      resume: () => setPremium((p) => ({ ...p, cancelAt: null })),
      consumeScan: () =>
        setScanLog((log) => {
          const t = todayKey()
          return { [t]: Math.min((log[t] ?? 0) + 1, 99) }
        }),
    }
  }, [premium, scanLog, hydrated])

  return <PremiumContext.Provider value={store}>{children}</PremiumContext.Provider>
}

export function usePremium(): PremiumStore {
  const ctx = useContext(PremiumContext)
  if (!ctx) throw new Error("usePremium must be used inside <PremiumProvider>")
  return ctx
}
