import { db, getSessionUserFromToken, rateLimit, destroyAllUserSessions, SESSION_COOKIE } from "@/lib/server/db"
import { validateAccountForServer } from "@/lib/account-schema"

export const dynamic = "force-dynamic"

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const MEALS = ["breakfast", "lunch", "dinner", "snacks"] as const

function parseCookie(cookie: string, name: string): string | undefined {
  const m = new RegExp(`(?:^|;\\s*)${name}=([^;]*)`).exec(cookie)
  return m ? decodeURIComponent(m[1]) : undefined
}

async function authed(request: Request) {
  return getSessionUserFromToken(parseCookie(request.headers.get("cookie") ?? "", SESSION_COOKIE))
}

/** Day payload: strictly typed, bounded. */
function sanitizeDay(raw: unknown): { date: string; data: unknown } | null {
  if (!raw || typeof raw !== "object") return null
  const s = raw as Record<string, unknown>
  const meals: Record<string, unknown[]> = {}
  const mealsRaw = (s.meals ?? {}) as Record<string, unknown>
  for (const key of MEALS) {
    const arr = mealsRaw[key]
    if (!Array.isArray(arr)) return null
    if (arr.length > 100) return null
    meals[key] = arr
  }
  const date = typeof s.date === "string" && DATE_RE.test(s.date) ? s.date : null
  if (!date) return null
  const out = {
    date,
    meals,
    water: Math.min(50, Math.max(0, Math.round(Number(s.water) || 0))),
    history: Array.isArray(s.history)
      ? (s.history as unknown[]).filter((d) => d && typeof d === "object" && DATE_RE.test((d as { date?: string }).date ?? "")).slice(0, 400)
      : [],
  }
  return { date, data: out }
}

/** Health payload: at most 400 days of strictly numeric counters. */
function sanitizeHealth(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object") return null
  const daysRaw = (raw as { days?: unknown }).days
  if (!daysRaw || typeof daysRaw !== "object") return null
  const days: Record<string, { steps: number; workoutMinutes: number; sensorSteps: number }> = {}
  let count = 0
  for (const [date, day] of Object.entries(daysRaw as Record<string, unknown>)) {
    if (!DATE_RE.test(date) || count >= 400) continue
    if (!day || typeof day !== "object") continue
    const d = day as Record<string, unknown>
    days[date] = {
      steps: Math.min(200_000, Math.max(0, Math.round(Number(d.steps) || 0))),
      workoutMinutes: Math.min(1440, Math.max(0, Math.round(Number(d.workoutMinutes) || 0))),
      sensorSteps: Math.min(200_000, Math.max(0, Math.round(Number(d.sensorSteps) || 0))),
    }
    count += 1
  }
  return { days }
}

export async function GET(request: Request, ctx: { params: Promise<{ resource: string }> }) {
  const user = await authed(request)
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const { resource } = await ctx.params

  if (resource === "account") {
    return Response.json({ account: await db.getJson("account", user.id) })
  }

  if (resource === "health") {
    return Response.json({ health: await db.getJson("health", user.id) })
  }

  if (resource === "day") {
    const date = new URL(request.url).searchParams.get("date")
    if (!date || !DATE_RE.test(date)) return Response.json({ error: "Invalid date" }, { status: 400 })
    return Response.json({ day: await db.getDay(user.id, date) })
  }

  if (resource === "days") {
    return Response.json({ days: await db.listDays(user.id) })
  }

  if (resource === "scans") {
    return Response.json({ scans: await db.listScans(user.id) })
  }

  return Response.json({ error: "Not found" }, { status: 404 })
}

export async function PUT(request: Request, ctx: { params: Promise<{ resource: string }> }) {
  const user = await authed(request)
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const { resource } = await ctx.params

  if (resource === "account") {
    const limit = rateLimit(`sync:account:${user.id}`, 60, 60 * 1000)
    if (!limit.ok) return Response.json({ error: "Too many requests" }, { status: 429 })

    const body = (await request.json().catch(() => null)) as { account?: unknown } | null
    const clean = validateAccountForServer(body?.account)
    if (!clean) return Response.json({ error: "Invalid account payload" }, { status: 400 })
    await db.putJson("account", user.id, clean)
    return Response.json({ ok: true })
  }

  if (resource === "health") {
    const limit = rateLimit(`sync:health:${user.id}`, 60, 60 * 1000)
    if (!limit.ok) return Response.json({ error: "Too many requests" }, { status: 429 })

    const body = (await request.json().catch(() => null)) as { health?: unknown } | null
    const clean = sanitizeHealth(body?.health)
    if (!clean) return Response.json({ error: "Invalid health payload" }, { status: 400 })
    await db.putJson("health", user.id, clean)
    return Response.json({ ok: true })
  }

  if (resource === "day") {
    const limit = rateLimit(`sync:day:${user.id}`, 120, 60 * 1000)
    if (!limit.ok) return Response.json({ error: "Too many requests" }, { status: 429 })

    const body = (await request.json().catch(() => null)) as { day?: unknown } | null
    const clean = sanitizeDay(body?.day)
    if (!clean) return Response.json({ error: "Invalid day payload" }, { status: 400 })
    await db.putDay(user.id, clean.date, clean.data)
    return Response.json({ ok: true })
  }

  return Response.json({ error: "Not found" }, { status: 404 })
}

export async function POST(request: Request, ctx: { params: Promise<{ resource: string }> }) {
  const user = await authed(request)
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const { resource } = await ctx.params

  if (resource === "scans") {
    const limit = rateLimit(`scans:post:${user.id}`, 30, 60 * 60 * 1000)
    if (!limit.ok) return Response.json({ error: "Too many scans stored, try later" }, { status: 429 })

    const body = (await request.json().catch(() => null)) as { scan?: unknown } | null
    const scan = body?.scan as { id?: unknown; date?: unknown; dish?: unknown; result?: unknown } | null
    if (
      !scan ||
      typeof scan.id !== "string" ||
      scan.id.length > 64 ||
      typeof scan.date !== "string" ||
      !DATE_RE.test(scan.date) ||
      typeof scan.dish !== "string" ||
      scan.dish.length > 120 ||
      !scan.result
    )
      return Response.json({ error: "Invalid scan payload" }, { status: 400 })

    await db.putScan({ id: scan.id, userId: user.id, date: scan.date, dish: scan.dish, result: scan.result })
    return Response.json({ ok: true })
  }

  if (resource === "delete-all-data") {
    const limit = rateLimit(`delete:${user.id}`, 3, 60 * 60 * 1000)
    if (!limit.ok) return Response.json({ error: "Too many requests" }, { status: 429 })
    await db.clearUserData(user.id)
    return Response.json({ ok: true })
  }

  if (resource === "delete-account") {
    const limit = rateLimit(`delacc:${user.id}`, 3, 60 * 60 * 1000)
    if (!limit.ok) return Response.json({ error: "Too many requests" }, { status: 429 })
    await destroyAllUserSessions(user.id)
    await db.deleteUser(user.id) // cascades to all user tables
    return Response.json({ ok: true }, { headers: { "Set-Cookie": `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0` } })
  }

  return Response.json({ error: "Not found" }, { status: 404 })
}
