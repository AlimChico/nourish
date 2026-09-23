import { db, getSessionUserFromToken, rateLimit, clientIp, SESSION_COOKIE } from "@/lib/server/db"

export const dynamic = "force-dynamic"

/**
 * Premium in Tunisian dinar (TND).
 * Plans are priced in millimes (1 TND = 1000 millimes). The checkout is a demo
 * flow (no PSP connected yet) — real money movement should go through Flouci /
 * D17 / e-Dinar; activation codes are verified server-side and grant months.
 */
const PLANS: Record<string, { label: string; amountMillimes: number; months: number }> = {
  monthly: { label: "Mensuel", amountMillimes: 29_000, months: 1 }, // 29,000 DT / mois
  yearly: { label: "Annuel", amountMillimes: 199_000, months: 12 }, // 199,000 DT / an
}

function parseCookie(cookie: string, name: string): string | undefined {
  const m = new RegExp(`(?:^|;\\s*)${name}=([^;]*)`).exec(cookie)
  return m ? decodeURIComponent(m[1]) : undefined
}

async function authed(request: Request) {
  return getSessionUserFromToken(parseCookie(request.headers.get("cookie") ?? "", SESSION_COOKIE))
}

/** Credit `months` of premium on the cloud account (data.premiumUntil ISO date). */
async function grantPremiumMonths(userId: string, months: number, source: string): Promise<{ until: string }> {
  // Read the raw stored JSON (already sanitized by validateAccountForServer on
  // write) — normalizeAccount would strip the non-schema premiumUntil field.
  const raw = ((await db.getJson("account", userId)) ?? {}) as Record<string, unknown>
  const today = new Date()
  let base = today
  const prev = typeof raw.premiumUntil === "string" ? new Date(raw.premiumUntil + "T00:00:00") : null
  if (prev && prev > today) base = prev // stack months on an active subscription
  base.setMonth(base.getMonth() + months)
  const until = base.toISOString().slice(0, 10)
  await db.putJson("account", userId, { ...raw, premiumUntil: until, premiumSource: source })
  return { until }
}

export async function POST(request: Request, ctx: { params: Promise<{ action: string }> }) {
  const { action } = await ctx.params
  const user = await authed(request)

  if (action === "checkout") {
    // Demo checkout: validates the plan and returns the amount to pay in TND.
    // A real PSP integration (Flouci payment link / D17) replaces this step.
    const limit = rateLimit(`pay:${clientIp(request)}`, 10, 60 * 1000)
    if (!limit.ok) return Response.json({ error: "Too many requests" }, { status: 429 })
    if (!user) return Response.json({ error: "Sign in required" }, { status: 401 })

    const body = (await request.json().catch(() => null)) as { plan?: string } | null
    const plan = PLANS[body?.plan ?? ""]
    if (!plan) return Response.json({ error: "Invalid plan" }, { status: 400 })

    return Response.json({
      ok: true,
      demo: true,
      amountMillimes: plan.amountMillimes,
      amountTND: (plan.amountMillimes / 1000).toFixed(3),
      label: plan.label,
      months: plan.months,
      currency: "TND",
    })
  }

  if (action === "redeem") {
    // Real server-side activation via code.
    const limit = rateLimit(`redeem:${clientIp(request)}`, 10, 60 * 1000)
    if (!limit.ok) return Response.json({ error: "Too many requests" }, { status: 429 })
    if (!user) return Response.json({ error: "Sign in required" }, { status: 401 })

    const body = (await request.json().catch(() => null)) as { code?: string } | null
    const code = typeof body?.code === "string" ? body.code.trim().toUpperCase().slice(0, 40) : ""
    if (!code) return Response.json({ error: "Code requis" }, { status: 400 })

    const r = await db.redeemPremiumCode(code, user.id)
    if (!r.ok || !r.months) return Response.json({ error: r.reason ?? "Code invalide" }, { status: 400 })

    const granted = await grantPremiumMonths(user.id, r.months, `code:${code}`)
    return Response.json({ ok: true, months: r.months, premiumUntil: granted.until })
  }

  return Response.json({ error: "Unknown action" }, { status: 404 })
}

export async function GET(request: Request, ctx: { params: Promise<{ action: string }> }) {
  const { action } = await ctx.params
  if (action !== "status") return Response.json({ error: "Unknown action" }, { status: 404 })
  const user = await authed(request)
  if (!user) return Response.json({ premiumUntil: null })
  const raw = ((await db.getJson("account", user.id)) ?? {}) as { premiumUntil?: string | null }
  return Response.json({ premiumUntil: raw.premiumUntil ?? null })
}
