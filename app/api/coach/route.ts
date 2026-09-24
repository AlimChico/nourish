import { rateLimit, clientIp } from "@/lib/server/db"
import { isDerja, DERJA_SYSTEM_RULES, DERJA_INTERJECTIONS } from "@/lib/derja"

export const dynamic = "force-dynamic"
export const maxDuration = 60

/** Free tier: 3 AI coach chats / day (premium unlimited). */
const FREE_DAILY_CHATS = 3

type CoachContext = {
  name?: string
  goal?: string
  targetCalories?: number
  eaten?: number
  remaining?: number
  protein?: { eaten: number; target: number }
  water?: { drunk: number; target: number }
  steps?: number
  workoutMinutes?: number
  streak?: number
  weightTrend?: { latest: number; changePerWeek: number } | null
  question: string
}

const SYSTEM_PROMPT = `Tu es "Coach Sahtek", coach nutrition et fitness bienveillant pour l'app Sahtek (Tunisie 🇹🇳).

Règles:
- Réponds TOUJOURS en français, ton chaleureux, direct, motivant (tutoiement).
- Appuie-toi sur les DONNÉES RÉELLES fournies (calories restantes, protéines, eau, pas, streak…) — cite-les précisément.
- Conseils pratiques adaptés à la Tunisie: plats locaux (couscous, lablabi, chorba, mechouia, brik au four…), produits accessibles.
- Pas de régime extrême, pas de conseil médical (renvoie à un pro si question santé précise).
- Reste COURT: 120 mots max, 3-5 puces max si liste. Termine par une micro-action concrète pour aujourd'hui.`

function buildUserPrompt(ctx: CoachContext): string {
  const lines = [
    `Utilisateur: ${ctx.name ?? "inconnu"} — objectif: ${ctx.goal === "lose" ? "perdre du poids" : ctx.goal === "gain" ? "prendre du muscle" : "maintenir"}.`,
    `Aujourd'hui: ${ctx.eaten ?? 0}/${ctx.targetCalories ?? 0} kcal (reste ${ctx.remaining ?? 0}).`,
    `Protéines: ${ctx.protein?.eaten ?? 0}/${ctx.protein?.target ?? 0} g. Eau: ${ctx.water?.drunk ?? 0}/${ctx.water?.target ?? 0} verres.`,
    `Pas: ${ctx.steps ?? 0}. Workout: ${ctx.workoutMinutes ?? 0} min. Streak: ${ctx.streak ?? 0} jour(s).`,
  ]
  if (ctx.weightTrend) {
    lines.push(`Poids: ${ctx.weightTrend.latest} kg (${ctx.weightTrend.changePerWeek > 0 ? "+" : ""}${ctx.weightTrend.changePerWeek.toFixed(1)} kg/semaine).`)
  }
  lines.push(``, `Question: ${ctx.question}`)
  return lines.join("\n")
}

/** Fallback local — français. */
function fallbackAnswer(ctx: CoachContext): string {
  const remaining = ctx.remaining ?? 0
  const pLeft = Math.max(0, (ctx.protein?.target ?? 0) - (ctx.protein?.eaten ?? 0))
  if (remaining <= 0) {
    return `Tu as atteint ton budget calories du jour (${ctx.targetCalories ?? 0} kcal) 👍 Bouge un peu ce soir (marche 15 min) et bois de l'eau — demain on repart propre.`
  }
  return `Il te reste **${remaining} kcal** et **${pLeft} g de protéines** aujourd'hui. Idéal : une source de protéines maigres (œufs, thon, poulet grillé, yaourt grec) + des légumes. Micro-action : logge ton prochain repas avant de manger pour rester dans le budget 💪`
}

/** Fallback local — derja tunisienne (arabizi), données réelles du jour. */
function fallbackAnswerDerja(ctx: CoachContext, name?: string): string {
  const remaining = ctx.remaining ?? 0
  const pLeft = Math.max(0, (ctx.protein?.target ?? 0) - (ctx.protein?.eaten ?? 0))
  const interj = DERJA_INTERJECTIONS[Math.floor(Math.random() * DERJA_INTERJECTIONS.length)]
  if (remaining <= 0) {
    return `${interj} ${name ?? "sahbi"}, wesseltna lel budget mta3 l youm (${ctx.targetCalories ?? 0} kcal) 👍 A3mel chwaya machi (15 min) w echreb elma — ghodwa nebdaw nidham.`
  }
  return `${interj} Baqi ${remaining} kcal w ${pLeft} g protéines lel youm. El a7san : protéines khfifa (3adam maslou9, ton, djej machwi, rayeb) + slata khadra. Micro-action : sajjel el makla 9bal ma takol, bech tb9a fel budget 💪`
}

export async function POST(request: Request) {
  const limit = rateLimit(`coach:${clientIp(request)}`, 20, 60 * 1000)
  if (!limit.ok) return Response.json({ error: "Trop de questions — Patiente une minute." }, { status: 429 })

  const body = (await request.json().catch(() => null)) as
    | { context?: CoachContext; freeChatUsed?: number; isPremium?: boolean; lang?: "fr" | "tn" }
    | null
  const question = typeof body?.context?.question === "string" ? body.context.question.trim().slice(0, 500) : ""
  if (!question) return Response.json({ error: "Pose ta question d'abord." }, { status: 400 })

  // Free users: 3 chats/day, enforced client-reported but also capped server-side by IP rate.
  if (!body?.isPremium && (body?.freeChatUsed ?? 0) >= FREE_DAILY_CHATS) {
    return Response.json({ error: "Quota gratuit atteint (3/jour) — passe Premium pour un coach illimité 👑", quota: true }, { status: 402 })
  }

  const ctx = body?.context as CoachContext
  // Derja auto-détection + mode forcé 🇹🇳 (lang === "tn")
  const lang = body?.lang === "tn" || isDerja(question) ? "tn" : "fr"
  const apiKey = process.env.ANTHROPIC_API_KEY
  const baseUrl = process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com"
  const fakeKey = !apiKey || apiKey.length < 20 || apiKey === "admin"
  const proxyBase = /openapis\.online|localhost|127\.0\.0\.1/i.test(baseUrl)

  if (fakeKey || proxyBase) {
    return Response.json({
      answer: lang === "tn" ? fallbackAnswerDerja(ctx, ctx.name) : fallbackAnswer(ctx),
      source: "fallback",
      lang,
    })
  }

  const system = lang === "tn" ? `${SYSTEM_PROMPT}\n${DERJA_SYSTEM_RULES}` : SYSTEM_PROMPT

  try {
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
        messages: [{ role: "user", content: buildUserPrompt(ctx) }],
      }),
    })
    clearTimeout(timeout)
    if (!res.ok) {
      return Response.json({
        answer: lang === "tn" ? fallbackAnswerDerja(ctx, ctx.name) : fallbackAnswer(ctx),
        source: "fallback",
        lang,
      })
    }
    const data = (await res.json()) as { content?: { type: string; text?: string }[] }
    const text = (data.content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "").join("\n").trim()
    return Response.json({
      answer: text || (lang === "tn" ? fallbackAnswerDerja(ctx, ctx.name) : fallbackAnswer(ctx)),
      source: "ai",
      lang,
    })
  } catch {
    return Response.json({
      answer: lang === "tn" ? fallbackAnswerDerja(ctx, ctx.name) : fallbackAnswer(ctx),
      source: "fallback",
      lang,
    })
  }
}
