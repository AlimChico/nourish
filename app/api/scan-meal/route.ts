export const maxDuration = 60

import { rateLimit, clientIp } from "@/lib/server/db"

type DetectedFood = {
  name: string
  portion: string
  quantity: number
  calories: number
  protein: number
  carbs: number
  fat: number
  confidence: number
  detail: string
}

type ScanResponse = {
  dish: string
  description: string
  items: DetectedFood[]
  tips: string
  source: "ai" | "demo"
  error?: string
}

const SYSTEM_PROMPT = `You are a nutrition vision expert. Analyze the meal photo and identify EVERY food you can see.

Respond with ONLY a valid JSON object (no markdown, no code fences) in this exact shape:
{
  "dish": "short dish name, e.g. 'Grilled chicken & rice plate'",
  "description": "1-2 sentence description of the meal as pictured",
  "items": [
    {
      "name": "food name",
      "portion": "estimated portion, e.g. '150 g' or '1 cup'",
      "quantity": 1,
      "calories": 165,
      "protein": 31,
      "carbs": 0,
      "fat": 4,
      "confidence": 0.92,
      "detail": "what you actually see for this item: color, cooking method, visible ingredients (e.g. 'grilled chicken breast with char marks, ~150g')"
    }
  ],
  "tips": "one short nutrition tip about this meal"
}

Rules:
- calories/protein/carbs/fat are NUMBERS for the estimated portion (kcal and grams).
- confidence is 0..1.
- quantity is how many servings the user likely ate (usually 1).
- Identify every distinct visible food item, including oils/sauces you can infer.
- If the image contains no food, return items: [] and explain in description.`

function buildDemoResult(): ScanResponse {
  return {
    dish: "Demo analysis (AI unavailable)",
    description:
      "The AI vision service is temporarily unreachable, so here is a sample analysis. Real recognition will return as soon as the service is back.",
    items: [
      {
        name: "Grilled Chicken Breast",
        portion: "150 g",
        quantity: 1,
        calories: 248,
        protein: 47,
        carbs: 0,
        fat: 6,
        confidence: 0.88,
        detail: "demo entry — replace with a real photo result when the AI service is back",
      },
      {
        name: "Brown Rice",
        portion: "1 cup",
        quantity: 1,
        calories: 216,
        protein: 5,
        carbs: 45,
        fat: 2,
        confidence: 0.8,
        detail: "demo entry",
      },
      {
        name: "Steamed Broccoli",
        portion: "1 cup",
        quantity: 1,
        calories: 55,
        protein: 4,
        carbs: 11,
        fat: 0,
        confidence: 0.75,
        detail: "demo entry",
      },
    ],
    tips: "This demo plate is protein-rich — pair it with water and veggies to stay balanced.",
    source: "demo",
  }
}

function extractJson(text: string): unknown {
  const cleaned = text.replace(/```json|```/g, "").trim()
  const start = cleaned.indexOf("{")
  const end = cleaned.lastIndexOf("}")
  if (start === -1 || end === -1) throw new Error("No JSON found in model response")
  return JSON.parse(cleaned.slice(start, end + 1))
}

function normalizeItem(raw: unknown): DetectedFood | null {
  if (!raw || typeof raw !== "object") return null
  const r = raw as Record<string, unknown>
  const name = typeof r.name === "string" ? r.name.trim() : ""
  if (!name) return null
  const num = (v: unknown, fb = 0) => (typeof v === "number" && isFinite(v) ? Math.max(0, Math.round(v)) : fb)
  return {
    name,
    portion: typeof r.portion === "string" && r.portion.trim() ? r.portion.trim() : "1 serving",
    quantity: typeof r.quantity === "number" && r.quantity > 0 ? Math.min(9, Math.round(r.quantity)) : 1,
    calories: num(r.calories),
    protein: num(r.protein),
    carbs: num(r.carbs),
    fat: num(r.fat),
    confidence: typeof r.confidence === "number" ? Math.min(1, Math.max(0.3, r.confidence)) : 0.75,
    detail: typeof r.detail === "string" ? r.detail.trim() : "",
  }
}

export async function POST(request: Request) {
  // Abuse guard: vision calls are expensive
  const limit = rateLimit(`scan:${clientIp(request)}`, 10, 60 * 1000)
  if (!limit.ok) {
    return Response.json(
      { ...buildDemoResult(), error: "Too many scans — wait a minute." } satisfies ScanResponse,
      { status: 429 },
    )
  }

  let imageDataUrl = ""
  try {
    const body = (await request.json()) as { image?: string }
    imageDataUrl = typeof body.image === "string" ? body.image : ""
  } catch {
    return Response.json({ ...buildDemoResult(), error: "Invalid request body" } satisfies ScanResponse, {
      status: 200,
    })
  }

  const match = /^data:(image\/(?:png|jpeg|jpg|webp|gif));base64,(.+)$/.exec(imageDataUrl)
  if (!match) {
    return Response.json(
      { ...buildDemoResult(), error: "No valid image provided" } satisfies ScanResponse,
      { status: 200 },
    )
  }
  const [, mediaType, base64] = match

  // Rough size guard (~4.5 MB base64 ≈ 3.4 MB binary, API limit is 5 MB)
  if (base64.length > 6_000_000) {
    return Response.json(
      { ...buildDemoResult(), error: "Image too large" } satisfies ScanResponse,
      { status: 200 },
    )
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  const baseUrl = process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com"
  // Placeholder/machine-level env values (e.g. ANTHROPIC_API_KEY=admin or a
  // third-party proxy URL) must not be treated as a real configuration.
  const looksFakeKey = !apiKey || apiKey.length < 20 || apiKey === "admin"
  const usesProxy = /openapis\.online|localhost|127\.0\.0\.1/i.test(baseUrl)
  if (looksFakeKey || usesProxy) {
    return Response.json(
      { ...buildDemoResult(), error: "Clé IA non configurée — ajoute ANTHROPIC_API_KEY dans les variables Vercel." } satisfies ScanResponse,
      { status: 200 },
    )
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 45_000)
    const res = await fetch(`${baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1600,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
              {
                type: "text",
                text: "Identify every food in this meal photo with detailed per-item breakdowns. Reply with the JSON object only.",
              },
            ],
          },
        ],
      }),
    })
    clearTimeout(timeout)

    if (!res.ok) {
      const detail = await res.text().catch(() => "")
      console.error("vision api error", res.status, detail.slice(0, 300))
      return Response.json(
        { ...buildDemoResult(), error: `AI service error (${res.status})` } satisfies ScanResponse,
        { status: 200 },
      )
    }

    const data = (await res.json()) as { content?: { type: string; text?: string }[] }
    const text = (data.content ?? [])
      .filter((c) => c.type === "text")
      .map((c) => c.text ?? "")
      .join("\n")

    const parsed = extractJson(text) as {
      dish?: string
      description?: string
      items?: unknown[]
      tips?: string
    }

    const items = (Array.isArray(parsed.items) ? parsed.items : [])
      .map(normalizeItem)
      .filter((x): x is DetectedFood => x !== null)

    if (items.length === 0) {
      return Response.json(
        {
          ...buildDemoResult(),
          dish: typeof parsed.dish === "string" ? parsed.dish : "No food detected",
          description:
            typeof parsed.description === "string" && parsed.description
              ? parsed.description
              : "The photo didn't contain any recognizable food. Try again with the plate fully in frame.",
          error: "No food detected",
        } satisfies ScanResponse,
        { status: 200 },
      )
    }

    const result: ScanResponse = {
      dish: typeof parsed.dish === "string" && parsed.dish ? parsed.dish : "Meal analysis",
      description: typeof parsed.description === "string" ? parsed.description : "",
      items,
      tips: typeof parsed.tips === "string" ? parsed.tips : "",
      source: "ai",
    }
    return Response.json(result, { status: 200 })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("scan-meal failed:", message)
    return Response.json(
      { ...buildDemoResult(), error: message.includes("abort") ? "AI request timed out" : "AI request failed" } satisfies ScanResponse,
      { status: 200 },
    )
  }
}
