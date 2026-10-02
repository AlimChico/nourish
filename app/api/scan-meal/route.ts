export const maxDuration = 60

import { rateLimit, clientIp } from "@/lib/server/db"

type DetectedFood = {
  name: string
  portion: string
  grams: number
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
  source: "ai"
  error?: "NO_FOOD"
  message?: string
}

type ScanErrorCode = "AI_UNAVAILABLE" | "AI_QUOTA" | "AI_TIMEOUT" | "RATE_LIMIT" | "BAD_IMAGE"

/**
 * Réponse d'erreur EXPLICITE : plus jamais de faux plat « estimation manuelle ».
 * L'utilisateur qui vient de prendre une photo doit savoir que le scanner ne
 * marche pas, pas recevoir trois aliments inventés.
 */
function scanError(code: ScanErrorCode, message: string, status: number) {
  return Response.json({ error: code, message } satisfies { error: ScanErrorCode; message: string }, { status })
}

const SYSTEM_PROMPT = `Tu es un expert en nutrition, spécialisé en cuisine TUNISIENNE et méditerranéenne 🇹🇳. Analyse la photo du repas et identifie CHAQUE aliment visible.

Pour chaque aliment, donne :
- name : le nom du plat ou aliment, en FRANÇAIS (garde le nom LOCAL des plats tunisiens : "Lablabi", "Kafteji", "Mloukhia"…)
- grams : le poids estimé de la portion, en GRAMMES (un NOMBRE précis — jamais "environ" ni une fourchette)
- portion : la portion en clair, ex. "1 bol (450 g)"
- quantity : le nombre de portions mangées (souvent 1)
- calories / protein / carbs / fat : des NOMBRES pour cette portion (kcal et grammes) — calcule-les précisément à partir des valeurs de référence ci-dessous, pas d'approximation
- confidence : exactement "high", "medium" ou "low"
- detail : ce que tu vois réellement (couleur, cuisson, ingrédients visibles)

REPÈRES DE TAILLE (indispensable pour un poids précis) : utilise les objets visibles autour du plat — assiette standard (~26 cm), couverts, verre (~200 ml), main, téléphone — pour calibrer la taille réelle de la portion et donner des grammes réalistes.

=== TUNISIAN DISH REFERENCE (use the LOCAL name + these realistic calories) ===
STEWS & MAIN DISHES (mar9a / plats)
- lablabi (400 g bowl): ~450 kcal — stale bread, chickpeas, harissa, olive oil, egg, cumin, tuna
- kosksi / couscous: chicken ~620, lamb ~720, fish (7out) ~580, vegetables ~420, osbane ~700, borghol djerbi ~560
- masfouf (sweet couscous, raisins/dates) ~550 · kosksi hlou ~600
- mloukhia (dark corète leaves + beef, 300 g) ~480 · mloukhia korros
- kamounia (beef + cumin) ~430 · marqa h'rous ~380 · mar9a tounsia ~350
- ojja: merguez ~640, shrimp/crevettes ~380, chicken ~520, plain egg+tomato ~330
- tajine tunisien (egg/meat/cheese mousse — a SAVOURY CAKE, not Moroccan) ~460
- kabkabou (fish + capers + tomato) ~420 · riz jerbi (tomato/pepper rice) ~450
- mhamsa bel hout ~480 · nwasser/nouaisser ~430 · tlitli (small pasta) ~400
- douwida (barley + herbs) ~300 · borghol bel khodra ~360 · pkaïla (chard + meat) ~380
- chakchouka ~320 · slata mechouia (grilled pepper/tomato salad) ~140 · slata tounsia ~110
- chorba frik ~210 · chorba h'ris ~280 · selte9? → dchicha (barley soup) ~180

STREET FOOD & SNACKS
- brik / brika à l'œuf ~310 per piece · brik au thon ~340 · fricassé (tuna sandwich) ~380
- kafteji (fried veg + pumpkin + potato, fried egg) ~620 · + meat ~720 · + egg ~680
- mlewi (mlawi) ~330 · msemen ~300 · mtabga ~350 · chapati/késra ~280
- khobz tabouna ~90 per slice · baguette ~250 · pain complet ~130
- grilled: djej machwi (chicken breast 150 g) ~240 · kefta/merguez grilled ~250 per 100 g · sardines ~200 per 4 · poisson grillé (dorade/merlan 150 g) ~180 · calamar frit ~250
- assida (semolina + honey/pignons) ~500 · bouza · zriga ~420

SWEETS (Tunisian pastry is very sweet — estimate generously)
- bambalouni (fried dough + sugar) ~290 per piece · zlabia ~150 per 2-3 pieces
- makroudh (date semolina) ~210 per piece · ka'ak warka ~180 · baklawa ~300 per slice
- ghriba (almond) ~150 · samsa ~220 · deblah ~200 · mkhabez ~190 · mazra? describe what you see

DAIRY, DRINKS & EXTRAS
- jben (fresh cheese) ~80 per portion · rayeb/lben (fermented milk, 250 ml) ~110 · yaourt ~80
- thé à la menthe (sugar) ~60 per glass · café turc/express ~5-25 · citronnade ~90 (with chia ~110)
- harissa ~25 per tbsp · zit zitouna (olive oil) ~90 per tbsp · olives ~60 per 10
- dates (deglet nour) ~60 per 3 · fruits (figue, grenade, melon, raisin, orange) use standard values

=== PACKAGED PRODUCTS ===
If a label or brand is visible (Dehia, Sama, Délice Danone, Natilait, Vikar, Bonna, Randa, Cielo, Moulin d'Or…), READ the printed values and use those instead of an estimate — and put the brand in the name.

=== PORTION GUIDANCE (Tunisian plates are generous) ===
bread slice = 60 g · bowl = 350-450 g (lablabi, chorba) · main plate = 350-400 g · brik/fricassé = 1 piece · couscous plate = 350 g · tablespoon of oil/harissa = 15-20 g.
If a cooked Tunisian dish is visible, use the reference above instead of guessing generic values — and always give its LOCAL name (e.g. "Lablabi", "Kafteji", "Mloukhia"). Say if it is homemade or restaurant-style when visible (restaurant portions are bigger and oilier: +15-20%).

Réponds UNIQUEMENT avec un JSON valide, sans texte autour, exactement de cette forme :
{
  "dish": "nom court du plat, ex. 'Lablabi avec un œuf mollet'",
  "description": "1-2 phrases décrivant le repas tel qu'il est photographié",
  "items": [
    {
      "name": "nom de l'aliment, en français",
      "grams": 450,
      "portion": "ex. '1 bol (450 g)'",
      "quantity": 1,
      "calories": 450,
      "protein": 20,
      "carbs": 68,
      "fat": 18,
      "confidence": "high",
      "detail": "ce que tu vois réellement pour cet aliment : couleur, cuisson, ingrédients visibles"
    }
  ],
  "tips": "un court conseil nutrition sur ce repas"
}

Règles :
- grams DOIT être un nombre (le poids réel de la portion en grammes) — utilise l'assiette et les couverts comme repère de taille.
- calories/protein/carbs/fat sont des NOMBRES pour cette portion (kcal et grammes) : valeurs de référence tunisiiennes ci-dessus, ajustées au poids estimé. Calcule, n'approxime pas.
- confidence vaut exactement "high", "medium" ou "low".
- quantity = nombre de portions que la personne a mangées (souvent 1).
- Identifie CHAQUE aliment distinct visible, y compris les huiles/sauces que tu peux déduire.
- Si l'image ne contient aucun aliment, renvoie "items": [] et explique-le dans description. N'invente JAMAIS de plat.`

function extractJson(text: string): unknown {
  const cleaned = text.replace(/```json|```/g, "").trim()
  const start = cleaned.indexOf("{")
  const end = cleaned.lastIndexOf("}")
  if (start === -1 || end === -1) throw new Error("No JSON found in model response")
  return JSON.parse(cleaned.slice(start, end + 1))
}

/**
 * Le modèle renvoie la confiance en "high"/"medium"/"low" (nouveau contrat).
 * On la ramène sur une échelle 0..1 pour l'affichage, tout en acceptant encore
 * les nombres (anciens modèles / petits modèles qui renvoient 0.9).
 */
function normalizeConfidence(v: unknown): number {
  if (typeof v === "number" && isFinite(v)) {
    const n = v > 1 ? v / 100 : v
    return Math.min(1, Math.max(0.3, n))
  }
  if (typeof v === "string") {
    const s = v.trim().toLowerCase()
    if (s.startsWith("high") || s === "haute" || s === "élevée") return 0.92
    if (s.startsWith("med") || s === "moyenne") return 0.7
    if (s.startsWith("low") || s === "faible" || s === "basse") return 0.5
    const n = parseFloat(s)
    if (isFinite(n)) return Math.min(1, Math.max(0.3, n > 1 ? n / 100 : n))
  }
  return 0.75
}

/** Récupère un poids (g) depuis le texte de portion, ex. "1 bol (450 g)". */
function gramsFromPortion(portion: string): number {
  const m = /(\d+(?:[.,]\d+)?)\s*(?:g|grammes?|ml)\b/i.exec(portion)
  if (!m) return 0
  const n = parseFloat(m[1].replace(",", "."))
  return isFinite(n) && n > 0 ? Math.min(5000, Math.round(n)) : 0
}

function normalizeItem(raw: unknown): DetectedFood | null {
  if (!raw || typeof raw !== "object") return null
  const r = raw as Record<string, unknown>
  const name = typeof r.name === "string" ? r.name.trim() : ""
  if (!name) return null
  const num = (v: unknown, fb = 0) => (typeof v === "number" && isFinite(v) ? Math.max(0, Math.round(v)) : fb)
  const portion = typeof r.portion === "string" && r.portion.trim() ? r.portion.trim() : "1 serving"
  // Poids de la portion : valeur explicite du modèle, sinon extraite du texte.
  const grams =
    typeof r.grams === "number" && isFinite(r.grams) && r.grams > 0
      ? Math.min(5000, Math.round(r.grams))
      : gramsFromPortion(portion)
  return {
    name,
    portion,
    grams,
    quantity: typeof r.quantity === "number" && r.quantity > 0 ? Math.min(9, Math.round(r.quantity)) : 1,
    calories: num(r.calories),
    protein: num(r.protein),
    carbs: num(r.carbs),
    fat: num(r.fat),
    confidence: normalizeConfidence(r.confidence),
    detail: typeof r.detail === "string" ? r.detail.trim() : "",
  }
}

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash"

/**
 * Modèle de secours si le principal est surchargé (503 high demand) :
 * gemini-flash-lite répond presque toujours, qualité suffisante pour l'analyse.
 */
const GEMINI_FALLBACK_MODELS = [
  "gemini-flash-lite-latest",
  "gemini-2.5-flash-lite",
  "gemini-flash-latest",
  "gemini-2.5-flash",
]

async function geminiGenerate(geminiKey: string, model: string, body: unknown): Promise<Response> {
  return fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(geminiKey)}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: (() => {
        const c = new AbortController()
        setTimeout(() => c.abort(), 45_000)
        return c.signal
      })(),
      body: JSON.stringify(body),
    },
  )
}

/**
 * Analyse vision via Google Gemini (AI Studio). Même contrat que le chemin
 * Anthropic : renvoie un ScanResponse, lève une ScanFailure (code + message
 * utilisateur) en cas d'indisponibilité.
 */
class ScanFailure extends Error {
  code: ScanErrorCode
  userMessage: string
  status: number
  constructor(code: ScanErrorCode, userMessage: string, status = 503) {
    super(userMessage)
    this.code = code
    this.userMessage = userMessage
    this.status = status
  }
}

/** Traduit une erreur fournisseur (429 quota, 503 surcharge, timeout) en message clair. */
function geminiFailure(status: number, detail: string, aborted: boolean): ScanFailure {
  const raw = /"message"\s*:\s*"([^"]+)/.exec(detail)?.[1] ?? ""
  if (aborted || /abort/i.test(raw)) {
    return new ScanFailure("AI_TIMEOUT", "L'analyse a pris trop de temps — réessaie avec une photo plus légère.")
  }
  const quota = status === 429 || /quota|exceeded|rate limit|billing/i.test(raw)
  if (quota) {
    return new ScanFailure(
      "AI_QUOTA",
      "Le scanner est momentanément saturé (quota d'analyse atteint). Réessaie dans quelques minutes — ta photo est gardée sur ton appareil.",
    )
  }
  if (status === 503 || /overloaded|unavailable|high demand/i.test(raw)) {
    return new ScanFailure(
      "AI_UNAVAILABLE",
      "Le moteur d'analyse est surchargé à cet instant. Réessaie dans une minute.",
      503,
    )
  }
  return new ScanFailure(
    "AI_UNAVAILABLE",
    "Le scanner d'aliments est indisponible pour le moment. Réessaie plus tard ou saisis ton plat à la main.",
    503,
  )
}

async function scanWithGemini(geminiKey: string, mediaType: string, base64: string): Promise<ScanResponse> {
  const buildBody = () => ({
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [
      {
        role: "user",
        parts: [
          { inline_data: { mime_type: mediaType, data: base64 } },
          {
            text: "Identify every food in this meal photo with detailed per-item breakdowns. Reply with the JSON object only.",
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 1600,
      responseMimeType: "application/json",
      thinkingConfig: { thinkingBudget: 0 },
    },
  })

  // Essaie le modèle principal, puis les fallbacks en cas de 503 (surcharge)
  // ou 429 (quota) — la dispo des modèles Gemini varie heure par heure.
  let res = await geminiGenerate(geminiKey, GEMINI_MODEL, buildBody())
  // 503/429 = modèle surchargé ; 404 = modèle inexistant/retiré (nom par défaut
  // périmé). Dans les deux cas on bascule sur un modèle disponible — c'est ce
  // qui fait que le scanner répond au lieu d'échouer.
  const retryable = (s: number) => s === 503 || s === 429 || s === 404
  if (retryable(res.status) && !process.env.GEMINI_MODEL) {
    for (const fallback of GEMINI_FALLBACK_MODELS) {
      console.warn("gemini model unavailable (" + res.status + "), trying fallback:", fallback)
      res = await geminiGenerate(geminiKey, fallback, buildBody())
      if (res.ok || !retryable(res.status)) break
    }
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => "")
    console.error("gemini vision api error", res.status, detail.slice(0, 300))
    throw geminiFailure(res.status, detail, false)
  }

  const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] }
  const text = (data.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("\n")

  let parsed: { dish?: string; description?: string; items?: unknown[]; tips?: string }
  try {
    parsed = extractJson(text) as typeof parsed
  } catch {
    // Réponse tronquée / non-JSON : on le dit (plutôt que d'inventer des plats).
    throw new ScanFailure(
      "AI_UNAVAILABLE",
      "Le scanner n'a pas réussi à analyser cette photo. Reprends-la (assiette entière, bonne lumière) puis réessaie.",
    )
  }

  const items = (Array.isArray(parsed.items) ? parsed.items : [])
    .map(normalizeItem)
    .filter((x): x is DetectedFood => x !== null)

  if (items.length === 0) {
    // Pas de nourriture reconnue : on répond SANS faux aliments — juste le
    // message clair pour l'utilisateur.
    return {
      dish: typeof parsed.dish === "string" && parsed.dish ? parsed.dish : "No food detected",
      description:
        typeof parsed.description === "string" && parsed.description
          ? parsed.description
          : "Aucun aliment reconnu sur cette photo. Recadre l'assiette entière, avec de la lumière, et réessaie.",
      items: [],
      tips: "",
      source: "ai",
      error: "NO_FOOD",
      message: "No food detected",
    }
  }

  return {
    dish: typeof parsed.dish === "string" && parsed.dish ? parsed.dish : "Meal analysis",
    description: typeof parsed.description === "string" ? parsed.description : "",
    items,
    tips: typeof parsed.tips === "string" ? parsed.tips : "",
    source: "ai",
  }
}

export async function POST(request: Request) {
  // Abuse guard: vision calls are expensive
  const limit = rateLimit(`scan:${clientIp(request)}`, 10, 60 * 1000)
  if (!limit.ok) {
    return scanError(
      "RATE_LIMIT",
      "Trop de scans d'affilée — attends une minute et réessaie.",
      429,
    )
  }

  let imageDataUrl = ""
  try {
    const body = (await request.json()) as { image?: string }
    imageDataUrl = typeof body.image === "string" ? body.image : ""
  } catch {
    return scanError("BAD_IMAGE", "Requête invalide — reprends la photo.", 400)
  }

  const match = /^data:(image\/(?:png|jpeg|jpg|webp|gif));base64,(.+)$/.exec(imageDataUrl)
  if (!match) {
    return scanError("BAD_IMAGE", "Aucune photo reçue — reprends la photo de ton plat.", 400)
  }
  const [, mediaType, base64] = match

  // Rough size guard (~4.5 MB base64 ≈ 3.4 MB binary, API limit is 5 MB)
  if (base64.length > 6_000_000) {
    return scanError("BAD_IMAGE", "Photo trop lourde — reprends-la (elle est compressée automatiquement).", 413)
  }

  // Provider IA : Anthropic (Claude) en priorité, sinon Google Gemini.
  // GEMINI_API_KEY (clé AI Studio, format AQ.Ab8…) → chemin Gemini ; le modèle
  // se règle via GEMINI_MODEL (défaut gemini-3.8-flash).
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || ""
  const geminiValid = geminiKey.length >= 20

  const apiKey = process.env.ANTHROPIC_API_KEY
  const baseUrl = process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com"
  // Placeholder/machine-level env values (e.g. ANTHROPIC_API_KEY=admin or a
  // third-party proxy URL) must not be treated as a real configuration.
  const looksFakeKey = !apiKey || apiKey.length < 20 || apiKey === "admin"
  const usesProxy = /openapis\.online|localhost|127\.0\.0\.1/i.test(baseUrl)

  if (geminiValid && (looksFakeKey || usesProxy)) {
    try {
      return Response.json(await scanWithGemini(geminiKey, mediaType, base64), { status: 200 })
    } catch (err) {
      if (err instanceof ScanFailure) {
        console.error("scan-meal (gemini) failed:", err.code)
        return scanError(err.code, err.userMessage, err.status)
      }
      const message = err instanceof Error ? err.message : String(err)
      console.error("scan-meal (gemini) failed:", message)
      const failure = geminiFailure(0, message, /abort|timeout/i.test(message))
      return scanError(failure.code, failure.userMessage, failure.status)
    }
  }

  if (looksFakeKey || usesProxy) {
    return scanError(
      "AI_UNAVAILABLE",
      "Le scanner n'est pas configuré sur ce serveur (clé d'analyse manquante).",
      503,
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
      const failure = geminiFailure(res.status, detail, false)
      return scanError(failure.code, failure.userMessage, failure.status)
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
          dish: typeof parsed.dish === "string" ? parsed.dish : "No food detected",
          description:
            typeof parsed.description === "string" && parsed.description
              ? parsed.description
              : "The photo didn't contain any recognizable food. Try again with the plate fully in frame.",
          items: [],
          tips: "",
          source: "ai",
          error: "NO_FOOD",
          message: "No food detected",
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
    const failure = geminiFailure(0, message, /abort|timeout/i.test(message))
    return scanError(failure.code, failure.userMessage, failure.status)
  }
}
