/**
 * Exercise database + workout generator.
 * Pick a muscle → get a structured session (warm-up, 4-6 exercises with
 * sets/reps/rest, cool-down) adapted to the chosen difficulty and equipment.
 */

export type MuscleKey =
  | "chest"
  | "back"
  | "shoulders"
  | "arms"
  | "legs"
  | "glutes"
  | "core"
  | "full"

export type Difficulty = "beginner" | "intermediate" | "advanced"

export type Exercise = {
  name: string
  muscles: MuscleKey[]
  equipment: "none" | "dumbbell" | "barbell" | "machine" | "band"
  /** base difficulty of the movement */
  level: Difficulty
  /** kcal per set (approx, 70 kg adult) */
  kcalPerSet: number
  cue: string
}

export const muscleMeta: Record<MuscleKey, { label: string; emoji: string; blurb: string }> = {
  chest: { label: "Chest", emoji: "🫁", blurb: "Push-ups, presses & flyes" },
  back: { label: "Back", emoji: "🔙", blurb: "Rows & pull movements" },
  shoulders: { label: "Shoulders", emoji: "🤸", blurb: "Presses & raises" },
  arms: { label: "Arms", emoji: "💪", blurb: "Biceps & triceps work" },
  legs: { label: "Legs", emoji: "🦵", blurb: "Squats, lunges & hinges" },
  glutes: { label: "Glutes", emoji: "🍑", blurb: "Hip hinges & bridges" },
  core: { label: "Core", emoji: "🎯", blurb: "Abs, obliques & stability" },
  full: { label: "Full body", emoji: "🧍", blurb: "Everything, efficiently" },
}

export const difficultyMeta: Record<Difficulty, { label: string; sets: string; restSec: number }> = {
  beginner: { label: "Beginner", sets: "2–3 sets", restSec: 90 },
  intermediate: { label: "Intermediate", sets: "3–4 sets", restSec: 75 },
  advanced: { label: "Advanced", sets: "4 sets", restSec: 60 },
}

const E: Exercise[] = [
  // ---------------------------------------------------------------- chest
  { name: "Push-ups", muscles: ["chest", "core", "full"], equipment: "none", level: "beginner", kcalPerSet: 14, cue: "Body in one line, elbows at 45°." },
  { name: "Knee push-ups", muscles: ["chest"], equipment: "none", level: "beginner", kcalPerSet: 9, cue: "Same form, knees on the floor." },
  { name: "Incline push-ups", muscles: ["chest"], equipment: "none", level: "beginner", kcalPerSet: 8, cue: "Hands on a bench or table." },
  { name: "Dumbbell bench press", muscles: ["chest"], equipment: "dumbbell", level: "intermediate", kcalPerSet: 20, cue: "Lower slowly, press up strong." },
  { name: "Dumbbell flyes", muscles: ["chest"], equipment: "dumbbell", level: "intermediate", kcalPerSet: 15, cue: "Wide arc, slight elbow bend." },
  { name: "Decline push-ups", muscles: ["chest", "shoulders"], equipment: "none", level: "advanced", kcalPerSet: 18, cue: "Feet elevated on a chair." },

  // ----------------------------------------------------------------- back
  { name: "Superman pulls", muscles: ["back", "core"], equipment: "none", level: "beginner", kcalPerSet: 8, cue: "Squeeze shoulder blades." },
  { name: "Towel rows", muscles: ["back"], equipment: "none", level: "beginner", kcalPerSet: 10, cue: "Row a towel against a door frame." },
  { name: "Bent-over dumbbell rows", muscles: ["back", "arms"], equipment: "dumbbell", level: "intermediate", kcalPerSet: 18, cue: "Flat back, pull to the hip." },
  { name: "Lat pulldown", muscles: ["back"], equipment: "machine", level: "intermediate", kcalPerSet: 16, cue: "Chest up, pull to the collarbone." },
  { name: "Pull-ups", muscles: ["back", "arms"], equipment: "none", level: "advanced", kcalPerSet: 24, cue: "Full hang, chin over bar." },

  // ------------------------------------------------------------ shoulders
  { name: "Arm circles", muscles: ["shoulders"], equipment: "none", level: "beginner", kcalPerSet: 5, cue: "Small to big circles." },
  { name: "Pike push-ups", muscles: ["shoulders", "chest"], equipment: "none", level: "intermediate", kcalPerSet: 15, cue: "Hips high, crown of head to floor." },
  { name: "Dumbbell shoulder press", muscles: ["shoulders"], equipment: "dumbbell", level: "intermediate", kcalPerSet: 17, cue: "Don't arch the lower back." },
  { name: "Lateral raises", muscles: ["shoulders"], equipment: "dumbbell", level: "beginner", kcalPerSet: 10, cue: "Lead with the elbows." },
  { name: "Handstand hold", muscles: ["shoulders", "core"], equipment: "none", level: "advanced", kcalPerSet: 20, cue: "Against a wall, hollow body." },

  // ----------------------------------------------------------------- arms
  { name: "Wall push-ups", muscles: ["arms", "chest"], equipment: "none", level: "beginner", kcalPerSet: 6, cue: "Close grip, elbows tucked." },
  { name: "Chair dips", muscles: ["arms", "chest"], equipment: "none", level: "intermediate", kcalPerSet: 13, cue: "Shoulders down, chest proud." },
  { name: "Dumbbell curls", muscles: ["arms"], equipment: "dumbbell", level: "beginner", kcalPerSet: 9, cue: "No swinging, full lockout." },
  { name: "Hammer curls", muscles: ["arms"], equipment: "dumbbell", level: "beginner", kcalPerSet: 9, cue: "Neutral grip throughout." },
  { name: "Diamond push-ups", muscles: ["arms", "chest"], equipment: "none", level: "advanced", kcalPerSet: 16, cue: "Hands together under the chest." },

  // ----------------------------------------------------------------- legs
  { name: "Bodyweight squats", muscles: ["legs", "glutes", "full"], equipment: "none", level: "beginner", kcalPerSet: 15, cue: "Knees out, chest up." },
  { name: "Forward lunges", muscles: ["legs", "glutes"], equipment: "none", level: "beginner", kcalPerSet: 14, cue: "Front shin vertical." },
  { name: "Goblet squats", muscles: ["legs", "glutes"], equipment: "dumbbell", level: "intermediate", kcalPerSet: 20, cue: "Weight at the chest, sit deep." },
  { name: "Bulgarian split squats", muscles: ["legs", "glutes"], equipment: "none", level: "advanced", kcalPerSet: 19, cue: "Rear foot on a chair." },
  { name: "Wall sit", muscles: ["legs"], equipment: "none", level: "intermediate", kcalPerSet: 8, cue: "Thighs parallel to the floor." },
  { name: "Jump squats", muscles: ["legs", "full"], equipment: "none", level: "advanced", kcalPerSet: 22, cue: "Land soft, absorb quietly." },

  // --------------------------------------------------------------- glutes
  { name: "Glute bridges", muscles: ["glutes", "core"], equipment: "none", level: "beginner", kcalPerSet: 10, cue: "Squeeze hard at the top." },
  { name: "Donkey kicks", muscles: ["glutes"], equipment: "none", level: "beginner", kcalPerSet: 8, cue: "Heel to the ceiling." },
  { name: "Romanian deadlifts", muscles: ["glutes", "legs", "back"], equipment: "dumbbell", level: "intermediate", kcalPerSet: 21, cue: "Hinge at the hips, flat back." },
  { name: "Single-leg bridges", muscles: ["glutes", "core"], equipment: "none", level: "intermediate", kcalPerSet: 13, cue: "Keep hips level." },
  { name: "Hip thrusts", muscles: ["glutes"], equipment: "dumbbell", level: "advanced", kcalPerSet: 24, cue: "Full extension, 1s squeeze." },

  // ----------------------------------------------------------------- core
  { name: "Dead bug", muscles: ["core"], equipment: "none", level: "beginner", kcalPerSet: 6, cue: "Low back glued to the floor." },
  { name: "Plank", muscles: ["core", "full"], equipment: "none", level: "beginner", kcalPerSet: 7, cue: "Squeeze glutes, no sagging." },
  { name: "Russian twists", muscles: ["core"], equipment: "none", level: "beginner", kcalPerSet: 8, cue: "Rotate from the ribcage." },
  { name: "Bicycle crunches", muscles: ["core"], equipment: "none", level: "intermediate", kcalPerSet: 11, cue: "Slow and controlled beats fast." },
  { name: "Hanging leg raises", muscles: ["core", "back"], equipment: "none", level: "advanced", kcalPerSet: 15, cue: "No swinging, straight legs." },
  { name: "Hollow body hold", muscles: ["core"], equipment: "none", level: "advanced", kcalPerSet: 10, cue: "Low back pressed down, arms by ears." },

  // ------------------------------------------------------------ full body
  { name: "Inchworms", muscles: ["full", "core"], equipment: "none", level: "beginner", kcalPerSet: 12, cue: "Walk hands out, stand up tall." },
  { name: "Mountain climbers", muscles: ["full", "core"], equipment: "none", level: "intermediate", kcalPerSet: 14, cue: "Hips low, fast knees." },
  { name: "Burpees", muscles: ["full"], equipment: "none", level: "advanced", kcalPerSet: 26, cue: "Chest to floor, jump at the top." },
  { name: "Jumping jacks", muscles: ["full"], equipment: "none", level: "beginner", kcalPerSet: 10, cue: "Steady rhythm, full extension." },
  { name: "High knees", muscles: ["full", "legs"], equipment: "none", level: "beginner", kcalPerSet: 11, cue: "Knees above hip height." },
]

export const exercises = E

const WARMUPS: Record<MuscleKey, string[]> = {
  chest: ["Arm circles × 20", "Scapula push-ups × 10"],
  back: ["Cat-cow × 8", "Band pull-aparts × 15"],
  shoulders: ["Arm circles × 20", "Wall slides × 10"],
  arms: ["Arm circles × 20", "Light curls × 15"],
  legs: ["Leg swings × 12/side", "Bodyweight squats × 10"],
  glutes: ["Glute bridges × 12", "Leg swings × 10/side"],
  core: ["Dead bug × 8/side", "Cat-cow × 8"],
  full: ["Jumping jacks × 30", "Leg swings × 10/side"],
}

const COOLDOWNS: Record<MuscleKey, string> = {
  chest: "Doorway chest stretch — 2 × 30 s/side",
  back: "Child's pose + knee-to-chest — 2 × 30 s",
  shoulders: "Cross-body shoulder stretch — 2 × 30 s/side",
  arms: "Triceps & biceps wall stretch — 2 × 30 s/side",
  legs: "Standing quad & hamstring stretch — 2 × 30 s/side",
  glutes: "Figure-4 glute stretch — 2 × 30 s/side",
  core: "Cobra stretch + child's pose — 2 × 30 s",
  full: "Full-body stretch flow — 3 min",
}

export type GeneratedWorkout = {
  muscle: MuscleKey
  difficulty: Difficulty
  warmup: string[]
  blocks: { exercise: Exercise; sets: number; reps: string }[]
  cooldown: string
  totalKcal: number
  estimatedMin: number
}

/** Build a session: 4-5 exercises, hardest last, adapted to the level. */
export function generateWorkout(muscle: MuscleKey, difficulty: Difficulty, hasEquipment: boolean): GeneratedWorkout {
  const pool = E.filter(
    (e) =>
      e.muscles.includes(muscle) &&
      e.equipment !== "machine" &&
      (hasEquipment || (e.equipment === "none" || e.equipment === "band")),
  )
  const order: Difficulty[] = difficulty === "beginner" ? ["beginner", "intermediate", "advanced"] : difficulty === "intermediate" ? ["beginner", "intermediate", "advanced"] : ["intermediate", "advanced", "beginner"]

  const pick: Exercise[] = []
  // 1 hard-ish main lift, 1 secondary, 2-3 assistance, scaled by difficulty.
  const wanted = difficulty === "beginner" ? 4 : 5
  for (const lvl of order) {
    for (const ex of pool.filter((p) => p.level === lvl)) {
      if (pick.length < wanted && !pick.some((p) => p.name === ex.name)) pick.push(ex)
    }
  }

  const dm = difficultyMeta[difficulty]
  const blocks = pick.map((ex, i) => {
    const main = i === 0
    const sets = difficulty === "beginner" ? (main ? 3 : 2) : difficulty === "intermediate" ? (main ? 4 : 3) : main ? 4 : 3
    const reps =
      ex.name.includes("Plank") || ex.name.includes("hold") || ex.name.includes("Hold") || ex.name === "Wall sit"
        ? "30–45 s"
        : difficulty === "beginner"
          ? "8–10"
          : difficulty === "intermediate"
            ? "10–12"
            : "12–15"
    return { exercise: ex, sets, reps }
  })

  const totalKcal = blocks.reduce((s, b) => s + b.exercise.kcalPerSet * b.sets, 0)
  const estimatedMin = Math.round(
    blocks.reduce((s, b) => s + b.sets * 2.2 + (dm.restSec / 60) * (b.sets - 1), 0) + 6, // warmup+cooldown
  )

  return {
    muscle,
    difficulty,
    warmup: WARMUPS[muscle],
    blocks,
    cooldown: COOLDOWNS[muscle],
    totalKcal: Math.round(totalKcal),
    estimatedMin,
  }
}
