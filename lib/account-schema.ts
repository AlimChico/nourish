// Pure account schema + validation — shared by the client store and the API routes (no React).

export type Gender = "male" | "female"
export type Goal = "lose" | "maintain" | "gain"
export type Units = "metric" | "imperial"
export type Diet = "none" | "vegetarian" | "vegan" | "pescatarian" | "halal"

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
  calorieOverride: number | null // manual daily calorie target (null = auto from BMR/TDEE)
  notifications: boolean
  diet: Diet
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
  calorieOverride: null,
  notifications: true,
  diet: "none",
  allergies: [],
  onboarded: false,
}

const ALLERGY_RE = /^[a-z0-9 _-]{1,40}$/i
const KNOWN_ALLERGENS = new Set(["gluten", "lactose", "nuts", "eggs", "shellfish", "soy"])

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

export function normalizeAccount(raw: unknown): AccountState {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_ACCOUNT }
  const s = raw as Partial<AccountState>
  return {
    name: typeof s.name === "string" ? s.name.trim().slice(0, 60) : "",
    email: typeof s.email === "string" ? s.email.trim().toLowerCase().slice(0, 254) : "",
    gender: s.gender === "male" ? "male" : "female",
    age: clamp(Number(s.age) || DEFAULT_ACCOUNT.age, 14, 90),
    height: clamp(Number(s.height) || DEFAULT_ACCOUNT.height, 120, 230),
    weight: clamp(Number(s.weight) || DEFAULT_ACCOUNT.weight, 30, 250),
    targetWeight: clamp(Number(s.targetWeight) || DEFAULT_ACCOUNT.targetWeight, 30, 250),
    activity: clamp(Number(s.activity) || DEFAULT_ACCOUNT.activity, 1.2, 1.9),
    goal: s.goal === "gain" ? "gain" : s.goal === "maintain" ? "maintain" : "lose",
    units: s.units === "imperial" ? "imperial" : "metric",
    waterGoal: clamp(Math.round(Number(s.waterGoal) || DEFAULT_ACCOUNT.waterGoal), 2, 20),
    stepGoal: clamp(Math.round(Number(s.stepGoal) || DEFAULT_ACCOUNT.stepGoal), 1000, 50000),
    calorieOverride:
      typeof s.calorieOverride === "number" && isFinite(s.calorieOverride)
        ? clamp(Math.round(s.calorieOverride), 800, 6000)
        : null,
    notifications: typeof s.notifications === "boolean" ? s.notifications : true,
    diet:
      s.diet === "vegetarian" || s.diet === "vegan" || s.diet === "pescatarian" || s.diet === "halal"
        ? s.diet
        : "none",
    allergies: Array.isArray(s.allergies)
      ? s.allergies
          .filter((x): x is string => typeof x === "string")
          .map((x) => x.trim().toLowerCase().slice(0, 40))
          .filter((x) => x && ALLERGY_RE.test(x))
          .slice(0, 12)
      : [],
    onboarded: s.onboarded === true,
  }
}

/** Validate an account payload for server-side writes. Returns the clean value or null. */
export function validateAccountForServer(raw: unknown): AccountState | null {
  const a = normalizeAccount(raw)
  if (typeof raw !== "object" || raw === null) return null
  if (!a.name || !a.email) return null
  const unknownAllergies = a.allergies.filter((x) => !KNOWN_ALLERGENS.has(x) && !ALLERGY_RE.test(x))
  if (unknownAllergies.length > 0) return null
  return a
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "N"
  return parts
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("")
}
