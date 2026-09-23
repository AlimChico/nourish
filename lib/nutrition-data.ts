export type MacroKey = "protein" | "carbs" | "fat"

export type Macros = {
  protein: number
  carbs: number
  fat: number
}

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

export type MealEntry = {
  food: FoodItem
  quantity: number
}

export type Meal = {
  id: string
  name: "Breakfast" | "Lunch" | "Dinner" | "Snacks"
  time: string
  entries: MealEntry[]
}

export const dailyTargets = {
  calories: 2150,
  protein: 140,
  carbs: 230,
  fat: 70,
  water: 8,
  steps: 10000,
}

export const consumed = {
  calories: 1420,
  protein: 82,
  carbs: 150,
  fat: 42,
  water: 5,
  steps: 6420,
  workoutMinutes: 30,
}

export const macroMeta: Record<
  MacroKey,
  { label: string; unit: string; color: string; soft: string; text: string }
> = {
  protein: {
    label: "Protein",
    unit: "g",
    color: "bg-protein",
    soft: "bg-protein-soft",
    text: "text-protein",
  },
  carbs: {
    label: "Carbs",
    unit: "g",
    color: "bg-carbs",
    soft: "bg-carbs-soft",
    text: "text-carbs",
  },
  fat: {
    label: "Fat",
    unit: "g",
    color: "bg-fat",
    soft: "bg-fat-soft",
    text: "text-fat",
  },
}

export const todayMeals: Meal[] = [
  {
    id: "breakfast",
    name: "Breakfast",
    time: "8:30 AM",
    entries: [
      {
        quantity: 1,
        food: {
          id: "oats",
          name: "Greek Yogurt & Berries",
          serving: "1 bowl",
          calories: 320,
          protein: 24,
          carbs: 38,
          fat: 8,
          emoji: "🥣",
        },
      },
      {
        quantity: 1,
        food: {
          id: "coffee",
          name: "Oat Milk Latte",
          serving: "1 cup",
          calories: 120,
          protein: 4,
          carbs: 16,
          fat: 4,
          emoji: "☕",
        },
      },
    ],
  },
  {
    id: "lunch",
    name: "Lunch",
    time: "1:00 PM",
    entries: [
      {
        quantity: 1,
        food: {
          id: "bowl",
          name: "Grilled Chicken Bowl",
          serving: "1 bowl",
          calories: 540,
          protein: 42,
          carbs: 52,
          fat: 18,
          emoji: "🥗",
        },
      },
    ],
  },
  {
    id: "dinner",
    name: "Dinner",
    time: "—",
    entries: [],
  },
  {
    id: "snacks",
    name: "Snacks",
    time: "4:30 PM",
    entries: [
      {
        quantity: 1,
        food: {
          id: "almonds",
          name: "Almonds",
          serving: "30 g",
          calories: 170,
          protein: 6,
          carbs: 6,
          fat: 15,
          emoji: "🥜",
        },
      },
      {
        quantity: 1,
        food: {
          id: "apple",
          name: "Apple",
          serving: "1 medium",
          calories: 95,
          protein: 0,
          carbs: 25,
          fat: 0,
          emoji: "🍎",
        },
      },
    ],
  },
]

export const foodCategories = [
  { id: "fruit", label: "Fruits", emoji: "🍓" },
  { id: "veg", label: "Veggies", emoji: "🥦" },
  { id: "protein", label: "Protein", emoji: "🍗" },
  { id: "grains", label: "Grains", emoji: "🌾" },
  { id: "dairy", label: "Dairy", emoji: "🧀" },
  { id: "drinks", label: "Drinks", emoji: "🥤" },
  { id: "snacks", label: "Snacks", emoji: "🍪" },
  { id: "meals", label: "Meals", emoji: "🍜" },
]

export const foodDatabase: FoodItem[] = [
  { id: "banana", name: "Banana", serving: "1 medium", calories: 105, protein: 1, carbs: 27, fat: 0, emoji: "🍌" },
  { id: "egg", name: "Egg", serving: "1 large", calories: 78, protein: 6, carbs: 1, fat: 5, emoji: "🥚" },
  { id: "chicken", name: "Chicken Breast", serving: "100 g", calories: 165, protein: 31, carbs: 0, fat: 4, emoji: "🍗" },
  { id: "rice", name: "Brown Rice", serving: "1 cup", calories: 216, protein: 5, carbs: 45, fat: 2, emoji: "🍚" },
  { id: "salmon", name: "Salmon", serving: "100 g", calories: 208, protein: 20, carbs: 0, fat: 13, emoji: "🐟" },
  { id: "avocado", name: "Avocado", serving: "1/2 fruit", calories: 160, protein: 2, carbs: 9, fat: 15, emoji: "🥑" },
  { id: "oatmeal", name: "Oatmeal", serving: "1 cup", calories: 154, protein: 6, carbs: 27, fat: 3, emoji: "🥣" },
  { id: "protein-shake", name: "Protein Shake", serving: "1 scoop", calories: 120, protein: 24, carbs: 3, fat: 2, emoji: "🥤" },
  { id: "broccoli", name: "Broccoli", serving: "1 cup", calories: 55, protein: 4, carbs: 11, fat: 0, emoji: "🥦" },
  { id: "peanut-butter", name: "Peanut Butter", serving: "1 tbsp", calories: 94, protein: 4, carbs: 3, fat: 8, emoji: "🥜" },
  // Tunisian dishes
  { id: "couscous", name: "Couscous au poulet", brand: "Tunisian", serving: "1 assiette", calories: 490, protein: 28, carbs: 62, fat: 14, emoji: "🍲" },
  { id: "brik", name: "Brik à l'œuf", brand: "Tunisian", serving: "1 pièce", calories: 280, protein: 11, carbs: 22, fat: 17, emoji: "🥟" },
  { id: "lablabi", name: "Lablabi", brand: "Tunisian", serving: "1 bol", calories: 320, protein: 14, carbs: 45, fat: 9, emoji: "🥣" },
  { id: "ojja", name: "Ojja Merguez", brand: "Tunisian", serving: "1 assiette", calories: 410, protein: 22, carbs: 14, fat: 30, emoji: "🍳" },
  { id: "chakchouka", name: "Chakchouka", brand: "Tunisian", serving: "1 assiette", calories: 240, protein: 12, carbs: 18, fat: 13, emoji: "🌶️" },
  { id: "tajine-tn", name: "Tajine Tunisien", brand: "Tunisian", serving: "1 part", calories: 350, protein: 24, carbs: 12, fat: 22, emoji: "🥧" },
  { id: "mloukhia", name: "Mloukhia", brand: "Tunisian", serving: "1 assiette", calories: 380, protein: 26, carbs: 18, fat: 22, emoji: "🥘" },
  { id: "salade-mechouia", name: "Salade Mechouia", brand: "Tunisian", serving: "1 portion", calories: 160, protein: 4, carbs: 12, fat: 11, emoji: "🫑" },
  { id: "kafteji", name: "Kafteji", brand: "Tunisian", serving: "1 assiette", calories: 330, protein: 10, carbs: 28, fat: 20, emoji: "🍆" },
  { id: "slata-tounsia", name: "Slata Tounsia", brand: "Tunisian", serving: "1 portion", calories: 130, protein: 3, carbs: 10, fat: 9, emoji: "🥗" },
  { id: "makroudh", name: "Makroudh", brand: "Tunisian", serving: "2 pièces", calories: 220, protein: 3, carbs: 34, fat: 9, emoji: "🍯" },
  { id: "harissa", name: "Harissa", brand: "Tunisian", serving: "1 c. à soupe", calories: 30, protein: 1, carbs: 3, fat: 2, emoji: "🌶️" },
]

export const tunisianFoods: FoodItem[] = foodDatabase.filter((f) => f.brand === "Tunisian")

export const recentFoods: FoodItem[] = [
  foodDatabase[2],
  foodDatabase[0],
  foodDatabase[7],
  foodDatabase[5],
]

export const popularFoods: FoodItem[] = [
  foodDatabase[1],
  foodDatabase[3],
  foodDatabase[4],
  foodDatabase[6],
]

export const weeklyCalories = [
  { day: "Mon", value: 2010, target: 2150 },
  { day: "Tue", value: 1980, target: 2150 },
  { day: "Wed", value: 2240, target: 2150 },
  { day: "Thu", value: 1890, target: 2150 },
  { day: "Fri", value: 2100, target: 2150 },
  { day: "Sat", value: 2320, target: 2150 },
  { day: "Sun", value: 1420, target: 2150 },
]

export const weightHistory = [
  { label: "W1", value: 78.4 },
  { label: "W2", value: 78.0 },
  { label: "W3", value: 77.5 },
  { label: "W4", value: 77.1 },
  { label: "W5", value: 76.6 },
  { label: "W6", value: 76.2 },
  { label: "W7", value: 75.8 },
  { label: "W8", value: 75.3 },
]

export const workoutHistory = [
  { day: "Mon", minutes: 45, type: "Strength" },
  { day: "Tue", minutes: 0, type: "Rest" },
  { day: "Wed", minutes: 30, type: "Cardio" },
  { day: "Thu", minutes: 60, type: "Strength" },
  { day: "Fri", minutes: 0, type: "Rest" },
  { day: "Sat", minutes: 40, type: "Mobility" },
  { day: "Sun", minutes: 30, type: "Walk" },
]

export const workoutTypes = [
  { id: "strength", label: "Strength", emoji: "🏋️", calories: "~350 kcal" },
  { id: "run", label: "Running", emoji: "🏃", calories: "~420 kcal" },
  { id: "cycle", label: "Cycling", emoji: "🚴", calories: "~380 kcal" },
  { id: "yoga", label: "Yoga", emoji: "🧘", calories: "~180 kcal" },
  { id: "swim", label: "Swimming", emoji: "🏊", calories: "~450 kcal" },
  { id: "hiit", label: "HIIT", emoji: "🔥", calories: "~400 kcal" },
]

export function calcNutrition(input: {
  gender: "male" | "female"
  age: number
  height: number
  weight: number
  activity: number
  goal: "lose" | "maintain" | "gain"
}) {
  const { gender, age, height, weight, activity, goal } = input
  const bmr =
    gender === "male"
      ? 10 * weight + 6.25 * height - 5 * age + 5
      : 10 * weight + 6.25 * height - 5 * age - 161
  const tdee = bmr * activity
  const goalAdjust = goal === "lose" ? -0.2 : goal === "gain" ? 0.15 : 0
  const calories = Math.round((tdee * (1 + goalAdjust)) / 10) * 10
  const protein = Math.round((calories * (goal === "gain" ? 0.3 : 0.28)) / 4)
  const fat = Math.round((calories * 0.28) / 9)
  const carbs = Math.round((calories - protein * 4 - fat * 9) / 4)
  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    calories,
    protein,
    carbs,
    fat,
  }
}

export const activityLevels = [
  { value: 1.2, label: "Sedentary", desc: "Little or no exercise" },
  { value: 1.375, label: "Light", desc: "1–3 days / week" },
  { value: 1.55, label: "Moderate", desc: "3–5 days / week" },
  { value: 1.725, label: "Active", desc: "6–7 days / week" },
  { value: 1.9, label: "Athlete", desc: "Intense daily training" },
]
