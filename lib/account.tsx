"use client"

import { createContext, useContext, useEffect, useMemo, useState } from "react"
import { calcNutrition } from "@/lib/nutrition-data"
import {
  DEFAULT_ACCOUNT,
  normalizeAccount,
  type AccountState,
  type OnboardingData,
} from "@/lib/account-schema"
import { useSync, useCloudPush } from "@/lib/sync"

// Re-export the shared schema so existing imports keep working.
export { DEFAULT_ACCOUNT, normalizeAccount }
export type { AccountState, OnboardingData }
export type { Gender, Goal, Units, Diet } from "@/lib/account-schema"

const STORAGE_KEY = "nourish.account.v1"

/** Nutrition targets derived from the account (Mifflin-St Jeor via calcNutrition). */
export function computeTargets(a: AccountState) {
  const n = calcNutrition({
    gender: a.gender,
    age: a.age,
    height: a.height,
    weight: a.weight,
    activity: a.activity,
    goal: a.goal,
  })
  // A manual override (Settings → Goals) wins over the computed target.
  if (a.calorieOverride && a.calorieOverride >= 800) n.calories = a.calorieOverride
  return { ...n, water: a.waterGoal, steps: a.stepGoal }
}

type Store = {
  state: AccountState
  hydrated: boolean
  targets: ReturnType<typeof computeTargets>
  update: (patch: Partial<AccountState>) => void
  completeOnboarding: (data: OnboardingData) => void
  markOnboarded: () => void
  logout: () => void
  wipeAll: () => void
}

const AccountContext = createContext<Store | null>(null)

export function AccountProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AccountState>({ ...DEFAULT_ACCOUNT })
  const [hydrated, setHydrated] = useState(false)
  const { status, restoredAccount, consumeRestoredAccount } = useSync()

  // localStorage first — offline-first.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      setState(normalizeAccount(raw ? JSON.parse(raw) : null))
    } catch {
      setState({ ...DEFAULT_ACCOUNT })
    }
    setHydrated(true)
  }, [])

  // Then, if the server sent back a saved account (login on a new device), restore it.
  useEffect(() => {
    if (!restoredAccount) return
    setState(normalizeAccount(restoredAccount))
    consumeRestoredAccount()
  }, [restoredAccount, consumeRestoredAccount])

  useEffect(() => {
    if (!hydrated) return
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      // storage unavailable — keep in-memory state
    }
  }, [state, hydrated])

  // Mirror every account change to the SQLite backend (debounced, authed only).
  useCloudPush("account", state, { authed: status === "authed", enabled: hydrated })

  const store = useMemo<Store>(
    () => ({
      state,
      hydrated,
      targets: computeTargets(state),
      update: (patch) => setState((s) => normalizeAccount({ ...s, ...patch, onboarded: s.onboarded })),
      completeOnboarding: (data) => setState(normalizeAccount({ ...data, onboarded: true })),
      markOnboarded: () => setState((s) => normalizeAccount({ ...s, onboarded: true })),
      logout: () => setState((s) => normalizeAccount({ ...s, onboarded: false })),
      wipeAll: () => {
        try {
          window.localStorage.removeItem(STORAGE_KEY)
          window.localStorage.removeItem("nourish.food-log.v1")
          window.localStorage.removeItem("nourish.premium.v1")
          window.localStorage.removeItem("nourish.health.v1")
          window.localStorage.removeItem("nourish.weight.v1")
        } catch {
          // storage unavailable
        }
        setState({ ...DEFAULT_ACCOUNT })
      },
    }),
    [state, hydrated],
  )

  return <AccountContext.Provider value={store}>{children}</AccountContext.Provider>
}

export function useAccount(): Store {
  const ctx = useContext(AccountContext)
  if (!ctx) throw new Error("useAccount must be used inside <AccountProvider>")
  return ctx
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "N"
  return parts
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("")
}
