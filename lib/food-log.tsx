"use client"

import { createContext, useContext, useEffect, useMemo, useReducer, useRef, useState } from "react"
import { useSync, useCloudPush } from "@/lib/sync"

export type MacroKey = "protein" | "carbs" | "fat"

export type FoodItem = {
  id: string
  name: string
  brand?: string
  serving: string
  calories: number
  protein: number
  carbs: number
  fat: number
  emoji: string
}

export type MealKey = "breakfast" | "lunch" | "dinner" | "snacks"

export type MealEntry = {
  entryId: string
  food: FoodItem
  quantity: number
}

export type Meal = {
  key: MealKey
  name: string
  entries: MealEntry[]
}

export type DayHistory = {
  date: string // YYYY-MM-DD
  calories: number
  protein: number
  carbs: number
  fat: number
  water: number
}

export type LogState = {
  date: string
  meals: Record<MealKey, MealEntry[]>
  water: number
  history: DayHistory[]
}

export const mealMeta: Record<MealKey, { name: string; emoji: string }> = {
  breakfast: { name: "Breakfast", emoji: "🍳" },
  lunch: { name: "Lunch", emoji: "🥗" },
  dinner: { name: "Dinner", emoji: "🍽️" },
  snacks: { name: "Snacks", emoji: "🍎" },
}

export const mealOrder: MealKey[] = ["breakfast", "lunch", "dinner", "snacks"]

export function todayKey(now = new Date()): string {
  return now.toISOString().slice(0, 10)
}

function makeId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}_${crypto.randomUUID()}`
  }
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1e9)}`
}

function emptyState(): LogState {
  return { date: todayKey(), meals: { breakfast: [], lunch: [], dinner: [], snacks: [] }, water: 0, history: [] }
}

function normalize(state: unknown): LogState {
  const base = emptyState()
  if (!state || typeof state !== "object") return base
  const s = state as Partial<LogState>
  const meals = { ...base.meals }
  for (const key of Object.keys(mealMeta) as MealKey[]) {
    const arr = s.meals?.[key]
    if (Array.isArray(arr)) {
      meals[key] = arr.filter(
        (e): e is MealEntry => !!e && typeof e === "object" && !!e.food && typeof e.entryId === "string",
      )
    }
  }
  const history = Array.isArray(s.history)
    ? s.history.filter(
        (h): h is DayHistory =>
          !!h &&
          typeof h === "object" &&
          typeof h.date === "string" &&
          /^\d{4}-\d{2}-\d{2}$/.test(h.date) &&
          typeof h.calories === "number",
      )
    : []
  return {
    date: typeof s.date === "string" ? s.date : base.date,
    meals,
    water: typeof s.water === "number" && s.water >= 0 ? s.water : 0,
    history,
  }
}

type Action =
  | { type: "hydrate"; state: LogState }
  | { type: "rollover" }
  | { type: "add"; meal: MealKey; food: FoodItem; quantity?: number }
  | { type: "remove"; meal: MealKey; entryId: string }
  | { type: "setQuantity"; meal: MealKey; entryId: string; quantity: number }
  | { type: "water"; delta: number }
  | { type: "reset" }

function reducer(state: LogState, action: Action): LogState {
  switch (action.type) {
    case "hydrate":
      return action.state
    case "rollover":
      return rollover(state)
    case "add":
      return {
        ...state,
        meals: {
          ...state.meals,
          [action.meal]: [
            ...state.meals[action.meal],
            { entryId: makeId("e"), food: action.food, quantity: action.quantity ?? 1 },
          ],
        },
      }
    case "remove":
      return {
        ...state,
        meals: {
          ...state.meals,
          [action.meal]: state.meals[action.meal].filter((e) => e.entryId !== action.entryId),
        },
      }
    case "setQuantity":
      return {
        ...state,
        meals: {
          ...state.meals,
          [action.meal]: state.meals[action.meal].map((e) =>
            e.entryId === action.entryId ? { ...e, quantity: action.quantity } : e,
          ),
        },
      }
    case "water":
      return { ...state, water: Math.max(0, state.water + action.delta) }
    case "reset":
      return rollover(state)
  }
}

export function totalsFor(entries: MealEntry[]) {
  return entries.reduce(
    (acc, e) => ({
      calories: acc.calories + e.food.calories * e.quantity,
      protein: acc.protein + e.food.protein * e.quantity,
      carbs: acc.carbs + e.food.carbs * e.quantity,
      fat: acc.fat + e.food.fat * e.quantity,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  )
}

export function dayTotals(meals: Record<MealKey, MealEntry[]>) {
  return (Object.keys(mealMeta) as MealKey[]).reduce(
    (acc, key) => {
      const t = totalsFor(meals[key])
      return {
        calories: acc.calories + t.calories,
        protein: acc.protein + t.protein,
        carbs: acc.carbs + t.carbs,
        fat: acc.fat + t.fat,
      }
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  )
}

const STORAGE_KEY = "nourish.food-log.v1"
const MAX_WATER = 20
const MAX_HISTORY = 365

/** Archive the finished day into history and open a fresh, empty day. */
function rollover(state: LogState): LogState {
  const totals = dayTotals(state.meals)
  const hasAnyFood = (Object.keys(mealMeta) as MealKey[]).some((k) => state.meals[k].length > 0)
  const entry: DayHistory = {
    date: state.date,
    calories: Math.round(totals.calories),
    protein: Math.round(totals.protein),
    carbs: Math.round(totals.carbs),
    fat: Math.round(totals.fat),
    water: state.water,
  }
  const history = [entry, ...state.history.filter((h) => h.date !== state.date)]
    .filter((h) => hasAnyFood || h.water > 0 || h.calories > 0 || h.date !== state.date)
    .slice(0, MAX_HISTORY)
  return {
    ...state,
    date: todayKey(),
    meals: { breakfast: [], lunch: [], dinner: [], snacks: [] },
    water: 0,
    history,
  }
}

type Store = {
  state: LogState
  hydrated: boolean
  addFood: (meal: MealKey, food: FoodItem, quantity?: number) => void
  removeEntry: (meal: MealKey, entryId: string) => void
  setQuantity: (meal: MealKey, entryId: string, quantity: number) => void
  addWater: (delta: number) => void
  resetDay: () => void
  history: DayHistory[]
}

const LogContext = createContext<Store | null>(null)

export function FoodLogProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, emptyState)
  const [hydrated, setHydrated] = useState(false)
  const todayRef = useRef(todayKey())

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      const loaded = normalize(raw ? JSON.parse(raw) : null)
      if (loaded.date !== todayKey()) {
        // The stored day is over: archive it, start fresh at 0.
        dispatch({ type: "hydrate", state: rollover(loaded) })
      } else {
        dispatch({ type: "hydrate", state: loaded })
      }
    } catch {
      dispatch({ type: "hydrate", state: emptyState() })
    }
    setHydrated(true)
  }, [])

  // Archive automatically when the calendar day changes while the app is open.
  useEffect(() => {
    if (!hydrated) return
    const id = window.setInterval(() => {
      if (todayKey() !== todayRef.current) {
        todayRef.current = todayKey()
        dispatch({ type: "rollover" })
      }
    }, 30_000)
    return () => window.clearInterval(id)
  }, [hydrated])

  useEffect(() => {
    if (!hydrated) return
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      // storage unavailable — keep in-memory state
    }
  }, [state, hydrated])

  // Mirror the journal to the SQLite backend (debounced, authed only).
  const { status } = useSync()
  useCloudPush("day", state, { authed: status === "authed", enabled: hydrated })

  const store = useMemo<Store>(
    () => ({
      state,
      hydrated,
      addFood: (meal, food, quantity) => dispatch({ type: "add", meal, food, quantity }),
      removeEntry: (meal, entryId) => dispatch({ type: "remove", meal, entryId }),
      setQuantity: (meal, entryId, quantity) =>
        dispatch({ type: "setQuantity", meal, entryId, quantity: Math.max(0, quantity) }),
      addWater: (delta) => dispatch({ type: "water", delta: Math.max(-MAX_WATER, Math.min(MAX_WATER, delta)) }),
      resetDay: () => dispatch({ type: "reset" }),
      history: state.history,
    }),
    [state, hydrated],
  )

  return <LogContext.Provider value={store}>{children}</LogContext.Provider>
}

export function useFoodLog(): Store {
  const ctx = useContext(LogContext)
  if (!ctx) throw new Error("useFoodLog must be used inside <FoodLogProvider>")
  return ctx
}
