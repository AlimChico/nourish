"use client"

import { createContext, useContext, useEffect, useMemo, useState } from "react"
import { calcNutrition } from "@/lib/nutrition-data"

export type Gender = "male" | "female"
export type Goal = "lose" | "maintain" | "gain"
export type Units = "metric" | "imperial"

export type AccountState = {
  name: string
  email: string
  gender: Gender
  age: number
  height: number // cm
  weight: number // kg
  targetWeight: number // kg
  activity: number // 1.2 .. 1.9
  goal: Goal
  units: Units
  waterGoal: number // glasses / day
  stepGoal: number // steps / day
  notifications: boolean
  diet: "none" | "vegetarian" | "vegan" | "pescatarian" | "halal"
  allergies: string[]
  onboarded: boolean
}

export type OnboardingData = Omit<AccountState, "onboarded">

export const DEFAULT_ACCOUNT: AccountState = {
  name: "",
  email: "",
  gender: "female",
  age: 28,
  height: 168,
  weight: 72,
  targetWeight: 65,
  activity: 1.55,
  goal: "lose",
  units: "metric",
  waterGoal: 8,
  stepGoal: 10000,
  notifications: true,
  diet: "none",
  allergies: [],
  onboarded: false,
}

const STORAGE_KEY = "nourish.account.v1"

export function normalizeAccount(raw: unknown): AccountState {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_ACCOUNT }
  const s = raw as Partial<AccountState>
  return {
    name: typeof s.name === "string" ? s.name : "",
    email: typeof s.email === "string" ? s.email : "",
    gender: s.gender === "male" ? "male" : "female",
    age: clamp(Number(s.age) || DEFAULT_ACCOUNT.age, 14, 90),
    height: clamp(Number(s.height) || DEFAULT_ACCOUNT.height, 120, 230),
    weight: clamp(Number(s.weight) || DEFAULT_ACCOUNT.weight, 30, 250),
    targetWeight: clamp(Number(s.targetWeight) || DEFAULT_ACCOUNT.targetWeight, 30, 250),
    activity: Number(s.activity) || DEFAULT_ACCOUNT.activity,
    goal: s.goal === "gain" ? "gain" : s.goal === "maintain" ? "maintain" : "lose",
    units: s.units === "imperial" ? "imperial" : "metric",
    waterGoal: clamp(Math.round(Number(s.waterGoal) || DEFAULT_ACCOUNT.waterGoal), 2, 20),
    stepGoal: clamp(Math.round(Number(s.stepGoal) || DEFAULT_ACCOUNT.stepGoal), 1000, 50000),
    notifications: typeof s.notifications === "boolean" ? s.notifications : true,
    diet:
      s.diet === "vegetarian" || s.diet === "vegan" || s.diet === "pescatarian" || s.diet === "halal"
        ? s.diet
        : "none",
    allergies: Array.isArray(s.allergies) ? s.allergies.filter((x): x is string => typeof x === "string") : [],
    onboarded: s.onboarded === true,
  }
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

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

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      setState(normalizeAccount(raw ? JSON.parse(raw) : null))
    } catch {
      setState({ ...DEFAULT_ACCOUNT })
    }
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      // storage unavailable — keep in-memory state
    }
  }, [state, hydrated])

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
