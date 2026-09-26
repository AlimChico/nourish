import { rateLimit, clientIp } from "@/lib/server/db"
import { DERJA_SYSTEM_RULES } from "@/lib/derja"
import {
  SCENARIO_COVERAGE,
  detectLang,
  detectScenario,
  scenarioAnswer,
  genericAnswer,
  type CoachContext,
  type CoachLang,
} from "@/lib/coach-scenarios"

export const dynamic = "force-dynamic"
export const maxDuration = 60

/** Free tier: 3 AI coach chats / day (premium unlimited). */
const FREE_DAILY_CHATS = 3

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash"

const SYSTEM_PROMPT = `Tu es "Coach Sahtek", coach nutrition et fitness bienveillant pour l'app Sahtek (Tunisie 🇹🇳).

Règles:
- Réponds TOUJOURS dans la LANGUE du user (derja tunisienne arabizi, français ou anglais — elle est indiquée) — jamais un mélange.
- Ton chaleureux, direct, motivant (tutoiement en fr, "sahbi/sahra" en derja, décontracté en anglais).
- Appuie-toi sur les DONNÉES RÉELLES fournies (calories restantes, protéines, eau, pas, streak…) — cite-les précisément.
- Conseils pratiques adaptés à la Tunisie: plats locaux (couscous, lablabi, chorba, mechouia, brik au four…), produits accessibles.
- Pas de régime extrême, pas de conseil médical (renvoie à un pro si question santé précise).
- Reste COURT: 120 mots max, 3-5 puces max si liste. Termine par une micro-action concrète pour aujourd'hui.

${SCENARIO_COVERAGE}`

function buildUserPrompt(ctx: CoachContext, lang: CoachLang): string {
  const langLine =
    lang === "tn"
      ? "Réponds en derja tunisienne (arabizi latin)."
      : lang === "en"
        ? "Reply in English."
        : "Réponds en français."
  const lines = [
    langLine,
    `User: ${ctx.name ?? "unknown"} — goal: ${ctx.goal === "lose" ? "lose weight" : ctx.goal === "gain" ? "gain muscle" : "maintain"}.`,
    `Today: ${ctx.eaten ?? 0}/${ctx.targetCalories ?? 0} kcal (${ctx.remaining ?? 0} remaining).`,
    `Protein: ${ctx.protein?.eaten ?? 0}/${ctx.protein?.target ?? 0} g. Water: ${ctx.water?.drunk ?? 0}/${ctx.water?.target ?? 0} glasses.`,
    `Steps: ${ctx.steps ?? 0}. Workout: ${ctx.workoutMinutes ?? 0} min. Streak: ${ctx.streak ?? 0} day(s).`,
  ]
  if (ctx.weightTrend) {
    lines.push(`Weight: ${ctx.weightTrend.latest} kg (${ctx.weightTrend.changePerWeek > 0 ? "+" : ""}${ctx.weightTrend.changePerWeek.toFixed(1)} kg/week).`)
  }
  lines.push("", `Question: ${ctx.question}`)
  return lines.join("\n")
}

/** Fallback local : scénario détecté → réponse dédiée, sinon réponse générique. */
function localAnswer(ctx: CoachContext, lang: CoachLang): string {
  const scenario = detectScenario(ctx.question)
  if (scenario) return scenarioAnswer(scenario, lang, ctx)
  return genericAnswer(lang, ctx, ctx.name)
}

/* ---------------- Gemini (provider principal) ---------------- */

async function coachWithGemini(geminiKey: string, system: string, userPrompt: string): Promise<string> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 40_000)
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(geminiKey)}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 700,
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    },
  )
  clearTimeout(timeout)
  if (!res.ok) {
    const detail = await res.text().catch(() => "")
    console.error("gemini coach api error", res.status, detail.slice(0, 300))
    throw new Error(`AI service error (${res.status})`)
  }
  const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] }
  const text = (data.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("\n").trim()
  if (!text) throw new Error("empty completion")
  return text
}

/* ---------------- Anthropic (provider secondaire) ---------------- */

async function coachWithAnthropic(apiKey: string, baseUrl: string, system: string, userPrompt: string): Promise<string> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 40_000)
  const res = await fetch(`${baseUrl}/v1/messages`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    signal: controller.signal,
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 500,
      system,
      messages: [{ role: "user", content: userPrompt }],
    }),
  })
  clearTimeout(timeout)
  if (!res.ok) throw new Error(`AI service error (${res.status})`)
  const data = (await res.json()) as { content?: { type: string; text?: string }[] }
  const text = (data.content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "").join("\n").trim()
  if (!text) throw new Error("empty completion")
  return text
}

export async function POST(request: Request) {
  const limit = rateLimit(`coach:${clientIp(request)}`, 20, 60 * 1000)
  if (!limit.ok) return Response.json({ error: "Trop de questions — patiente une minute." }, { status: 429 })

  const body = (await request.json().catch(() => null)) as
    | { context?: CoachContext; freeChatUsed?: number; isPremium?: boolean; lang?: string }
    | null
  const question = typeof body?.context?.question === "string" ? body.context.question.trim().slice(0, 500) : ""
  if (!question) return Response.json({ error: "Pose ta question d'abord." }, { status: 400 })

  // Free users: 3 chats/day, enforced client-reported but also capped server-side by IP rate.
  if (!body?.isPremium && (body?.freeChatUsed ?? 0) >= FREE_DAILY_CHATS) {
    return Response.json({ error: "Quota gratuit atteint (3/jour) — passe Premium pour un coach illimité 👑", quota: true }, { status: 402 })
  }

  const ctx = body!.context as CoachContext
  // Langue : mode forcé (tn/fr/en) > derja auto > anglais auto > français.
  const lang = detectLang(question, body?.lang)
  const derjaSystem = lang === "tn" ? `\n${DERJA_SYSTEM_RULES}` : ""
  const system = `${SYSTEM_PROMPT}${derjaSystem}`

  // Provider IA : Gemini (GEMINI_API_KEY) prioritaire, sinon Anthropic.
  // Sans clé valide → réponses locales par scénarios (3 langues, données réelles).
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || ""
  const anthropicKey = process.env.ANTHROPIC_API_KEY
  const anthropicBase = process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com"
  const anthropicValid = Boolean(anthropicKey && anthropicKey.length >= 20 && anthropicKey !== "admin")
  const anthropicProxy = /openapis\.online|localhost|127\.0\.0\.1/i.test(anthropicBase)
  const geminiValid = geminiKey.length >= 20

  if (!geminiValid && !(anthropicValid && !anthropicProxy)) {
    return Response.json({ answer: localAnswer(ctx, lang), source: "fallback", lang })
  }

  try {
    const userPrompt = buildUserPrompt(ctx, lang)
    const answer = geminiValid
      ? await coachWithGemini(geminiKey, system, userPrompt)
      : await coachWithAnthropic(anthropicKey!, anthropicBase, system, userPrompt)
    return Response.json({ answer, source: "ai", lang })
  } catch {
    return Response.json({ answer: localAnswer(ctx, lang), source: "fallback", lang })
  }
}
