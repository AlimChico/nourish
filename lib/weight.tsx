"use client"

import { createContext, useContext, useEffect, useMemo, useState } from "react"
import { useSync, api } from "@/lib/sync"

export type WeightEntry = { date: string; kg: number }

const KEY = "nourish.weight.v1"
const MAX_ENTRIES = 500

function normalize(raw: unknown): WeightEntry[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((e): e is WeightEntry => !!e && typeof e === "object" && typeof e.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(e.date) && typeof e.kg === "number" && isFinite(e.kg))
    .map((e) => ({ date: e.date, kg: Math.min(400, Math.max(25, Math.round(e.kg * 10) / 10)) }))
    .slice(0, MAX_ENTRIES)
}

type Store = {
  entries: WeightEntry[] // sorted newest first
  hydrated: boolean
  addWeight: (kg: number, date?: string) => void
  removeWeight: (date: string) => void
  latest: WeightEntry | null
}

const Ctx = createContext<Store | null>(null)

export function WeightProvider({ children }: { children: React.ReactNode }) {
  const [entries, setEntries] = useState<WeightEntry[]>([])
  const [hydrated, setHydrated] = useState(false)
  const { status } = useSync()

  // localStorage first — offline-first.
  useEffect(() => {
    try {
      setEntries(normalize(JSON.parse(window.localStorage.getItem(KEY) || "[]")))
    } catch {
      setEntries([])
    }
    setHydrated(true)
  }, [])

  // Persist locally on every change.
  useEffect(() => {
    if (!hydrated) return
    try {
      window.localStorage.setItem(KEY, JSON.stringify(entries))
    } catch {
      // ignore
    }
  }, [entries, hydrated])

  // Cloud push (debounced) while logged in.
  useEffect(() => {
    if (!hydrated || status !== "authed") return
    const t = setTimeout(() => {
      void api("/api/sync/weight", { method: "PUT", body: JSON.stringify({ weight: entries }) })
    }, 1200)
    return () => clearTimeout(t)
  }, [entries, hydrated, status])

  // Cloud pull when a session appears (login on this browser).
  useEffect(() => {
    if (status !== "authed" || !hydrated) return
    let cancelled = false
    ;(async () => {
      const { data } = await api<{ weight: WeightEntry[] | null }>("/api/sync/weight")
      if (!cancelled && Array.isArray(data?.weight) && data.weight.length > 0) {
        const cloud = normalize(data.weight)
        // Merge: newest entry of each date wins.
        setEntries((local) => {
          const byDate = new Map<string, WeightEntry>()
          for (const e of cloud) byDate.set(e.date, e)
          for (const e of local) if (!byDate.has(e.date)) byDate.set(e.date, e)
          return [...byDate.values()].sort((a, b) => b.date.localeCompare(a.date)).slice(0, MAX_ENTRIES)
        })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [status, hydrated])

  const store = useMemo<Store>(
    () => ({
      entries,
      hydrated,
      latest: entries[0] ?? null,
      addWeight: (kg, date) =>
        setEntries((list) => {
          const d = date ?? new Date().toISOString().slice(0, 10)
          const filtered = list.filter((e) => e.date !== d)
          return [{ date: d, kg: Math.min(400, Math.max(25, Math.round(kg * 10) / 10)) }, ...filtered].sort((a, b) => b.date.localeCompare(a.date))
        }),
      removeWeight: (date) => setEntries((list) => list.filter((e) => e.date !== date)),
    }),
    [entries, hydrated],
  )

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>
}

export function useWeight(): Store {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error("useWeight must be used inside <WeightProvider>")
  return ctx
}
