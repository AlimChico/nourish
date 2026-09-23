"use client"

import type { FoodItem } from "@/lib/nutrition-data"

/**
 * Custom foods — user-created recipes/foods, persisted locally, stored under
 * the same shape as the global database so every screen accepts them.
 * "Requests" are wishes for foods to add to the global database.
 */

const CUSTOM_KEY = "nourish.custom-foods.v1"
const REQUESTS_KEY = "nourish.food-requests.v1"

export type CustomFood = FoodItem & {
  category: "custom"
  servings: number // how many servings the recipe makes
  createdAt: number
}

export type FoodRequest = {
  id: string
  name: string
  note?: string
  createdAt: number
}

function readList<T>(key: string): T[] {
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T[]) : []
  } catch {
    return []
  }
}

function writeList<T>(key: string, list: T[]): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(list.slice(0, 300)))
  } catch {
    // storage full/unavailable
  }
}

export function listCustomFoods(): CustomFood[] {
  return readList<CustomFood>(CUSTOM_KEY)
}

export function saveCustomFood(food: Omit<CustomFood, "category" | "createdAt" | "id">): CustomFood {
  const full: CustomFood = {
    ...food,
    id: `custom_${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`,
    category: "custom",
    createdAt: Date.now(),
  }
  const list = listCustomFoods()
  list.unshift(full)
  writeList(CUSTOM_KEY, list)
  return full
}

export function deleteCustomFood(id: string): void {
  writeList(
    CUSTOM_KEY,
    listCustomFoods().filter((f) => f.id !== id),
  )
}

export function listRequests(): FoodRequest[] {
  return readList<FoodRequest>(REQUESTS_KEY)
}

export function addFoodRequest(name: string, note?: string): FoodRequest {
  const req: FoodRequest = {
    id: `req_${Date.now().toString(36)}`,
    name: name.trim().slice(0, 80),
    note: note?.trim().slice(0, 200) || undefined,
    createdAt: Date.now(),
  }
  const list = listRequests()
  list.unshift(req)
  writeList(REQUESTS_KEY, list)
  return req
}

export function removeFoodRequest(id: string): void {
  writeList(
    REQUESTS_KEY,
    listRequests().filter((r) => r.id !== id),
  )
}

export function searchCustomFoods(query: string): CustomFood[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  return listCustomFoods().filter((f) => f.name.toLowerCase().includes(q))
}

// ---------------------------------------------------------------------------
// Recipe suggestions by remaining calories
// ---------------------------------------------------------------------------

export type Suggestion = {
  emoji: string
  name: string
  detail: string
  calories: number
  protein: number
  carbs: number
  fat: number
}

const RECIPE_POOL: Suggestion[] = [
  { emoji: "🥗", name: "Grilled chicken salad", detail: "Greens, cherry tomatoes, olive oil", calories: 320, protein: 32, carbs: 9, fat: 17 },
  { emoji: "🍲", name: "Small couscous veggie", detail: "Semoule, légumes, senza viande", calories: 280, protein: 9, carbs: 52, fat: 4 },
  { emoji: "🍳", name: "2-egg omelette", detail: "With herbs, side of tomato", calories: 200, protein: 14, carbs: 2, fat: 15 },
  { emoji: "🥣", name: "Greek yogurt & honey", detail: "Protein-rich, light snack", calories: 180, protein: 16, carbs: 20, fat: 3 },
  { emoji: "🐟", name: "Tuna salad sandwich", detail: "Whole grain bread, light mayo", calories: 340, protein: 24, carbs: 34, fat: 11 },
  { emoji: "🍎", name: "Apple & 10 almonds", detail: "Crunchy fiber-rich snack", calories: 190, protein: 4, carbs: 26, fat: 8 },
  { emoji: "🍜", name: "Vegetable soup + bread", detail: "Warm, filling, low-cal", calories: 230, protein: 7, carbs: 38, fat: 5 },
  { emoji: "🫓", name: "Half mlawi + lablabi", detail: "Tunisian classic, controlled portion", calories: 420, protein: 14, carbs: 62, fat: 12 },
  { emoji: "🥤", name: "Protein shake (banana)", detail: "Whey, banana, milk", calories: 260, protein: 26, carbs: 30, fat: 3 },
  { emoji: "🍤", name: "Shrimp & rice bowl", detail: "Light, high-protein dinner", calories: 390, protein: 30, carbs: 48, fat: 7 },
  { emoji: "🥑", name: "Avocado toast", detail: "Whole grain, chili flakes", calories: 290, protein: 8, carbs: 28, fat: 16 },
  { emoji: "🍢", name: "Chicken skewers (x2)", detail: "Grilled, with salad", calories: 350, protein: 38, carbs: 8, fat: 18 },
]

export function suggestRecipes(remainingKcal: number): Suggestion[] {
  if (remainingKcal <= 0) {
    // goal reached — suggest light options under 150 kcal
    return RECIPE_POOL.filter((r) => r.calories <= 200).slice(0, 3)
  }
  const fits = RECIPE_POOL.filter((r) => r.calories <= remainingKcal * 1.1)
  const sorted = [...fits].sort((a, b) => {
    // prefer options that use 40–90 % of what's left
    const scoreA = 1 - Math.abs(a.calories - remainingKcal * 0.65) / Math.max(remainingKcal, 1)
    const scoreB = 1 - Math.abs(b.calories - remainingKcal * 0.65) / Math.max(remainingKcal, 1)
    return scoreB - scoreA
  })
  return sorted.slice(0, 3)
}
