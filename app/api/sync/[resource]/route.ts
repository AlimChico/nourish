import { db, getSessionUser, rateLimit, clientIp, destroyAllUserSessions, SESSION_COOKIE } from "@/lib/server/db"
import { validateAccountForServer } from "@/lib/account-schema"

export const dynamic = "force-dynamic"

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const MEALS = ["breakfast", "lunch", "dinner", "snacks"] as const

function parseCookie(cookie: string, name: string): string | undefined {
  const m = new RegExp(`(?:^|;\\s*)${name}=([^;]*)`).exec(cookie)
  return m ? decodeURIComponent(m[1]) : undefined
}

function authed(request: Request) {
  return getSessionUser(parseCookie(request.headers.get("cookie") ?? "", SESSION_COOKIE))
}

/** Health payload: at most 400 days of strictly numeric step/workout counters. */
function sanitizeHealth(raw: unknown): string | null {
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
  return JSON.stringify({ days })
}

/** Merge-store the day payload: only the fields the client owns, strictly typed. */
function sanitizeDay(raw: unknown): string | null {
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
  const out = {
    date: typeof s.date === "string" && DATE_RE.test(s.date) ? s.date : null,
    meals,
    water: Math.min(50, Math.max(0, Math.round(Number(s.water) || 0))),
    history: Array.isArray(s.history)
      ? s.history
          .filter((d) => d && typeof d === "object" && DATE_RE.test((d as { date?: string }).date ?? ""))
          .slice(0, 400)
      : [],
  }
  if (!out.date) return null
  return JSON.stringify(out)
}

export async function GET(request: Request, ctx: { params: Promise<{ resource: string }> }) {
  const user = authed(request)
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const { resource } = await ctx.params

  if (resource === "account") {
    const row = db.prepare("SELECT data FROM account WHERE user_id = ?").get(user.id) as { data: string } | undefined
    return Response.json({ account: row ? JSON.parse(row.data) : null })
  }

  if (resource === "health") {
    const row = db.prepare("SELECT data FROM health WHERE user_id = ?").get(user.id) as { data: string } | undefined
    return Response.json({ health: row ? JSON.parse(row.data) : null })
  }

  if (resource === "day") {
    const date = new URL(request.url).searchParams.get("date")
    if (!date || !DATE_RE.test(date)) return Response.json({ error: "Invalid date" }, { status: 400 })
    const row = db.prepare("SELECT data FROM day_logs WHERE user_id = ? AND date = ?").get(user.id, date) as
      | { data: string }
      | undefined
    return Response.json({ day: row ? JSON.parse(row.data) : null })
  }

  if (resource === "days") {
    const rows = db.prepare("SELECT date, data FROM day_logs WHERE user_id = ? ORDER BY date DESC LIMIT 400").all(user.id) as {
      date: string
      data: string
    }[]
    return Response.json({ days: rows.map((r) => JSON.parse(r.data)) })
  }

  if (resource === "scans") {
    const rows = db
      .prepare("SELECT id, date, dish, result, created_at FROM scans WHERE user_id = ? ORDER BY created_at DESC LIMIT 100")
      .all(user.id) as { id: string; date: string; dish: string; result: string; created_at: number }[]
    return Response.json({
      scans: rows.map((r) => ({ id: r.id, date: r.date, dish: r.dish, result: JSON.parse(r.result), createdAt: r.created_at })),
    })
  }

  return Response.json({ error: "Not found" }, { status: 404 })
}

export async function PUT(request: Request, ctx: { params: Promise<{ resource: string }> }) {
  const user = authed(request)
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const { resource } = await ctx.params

  if (resource === "account") {
    const limit = rateLimit(`sync:account:${user.id}`, 60, 60 * 1000)
    if (!limit.ok) return Response.json({ error: "Too many requests" }, { status: 429 })

    const body = (await request.json().catch(() => null)) as { account?: unknown } | null
    const clean = validateAccountForServer(body?.account)
    if (!clean) return Response.json({ error: "Invalid account payload" }, { status: 400 })

    db.prepare(
      `INSERT INTO account (user_id, data, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
    ).run(user.id, JSON.stringify(clean), Date.now())
    return Response.json({ ok: true })
  }

  if (resource === "health") {
    const limit = rateLimit(`sync:health:${user.id}`, 60, 60 * 1000)
    if (!limit.ok) return Response.json({ error: "Too many requests" }, { status: 429 })

    const body = (await request.json().catch(() => null)) as { health?: unknown } | null
    const clean = sanitizeHealth(body?.health)
    if (!clean) return Response.json({ error: "Invalid health payload" }, { status: 400 })

    db.prepare(
      `INSERT INTO health (user_id, data, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
    ).run(user.id, clean, Date.now())
    return Response.json({ ok: true })
  }

  if (resource === "day") {
    const limit = rateLimit(`sync:day:${user.id}`, 120, 60 * 1000)
    if (!limit.ok) return Response.json({ error: "Too many requests" }, { status: 429 })

    const body = (await request.json().catch(() => null)) as { day?: unknown } | null
    const clean = sanitizeDay(body?.day)
    if (!clean) return Response.json({ error: "Invalid day payload" }, { status: 400 })
    const day = JSON.parse(clean) as { date: string }

    db.prepare(
      `INSERT INTO day_logs (user_id, date, data, updated_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(user_id, date) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
    ).run(user.id, day.date, clean, Date.now())
    return Response.json({ ok: true })
  }

  return Response.json({ error: "Not found" }, { status: 404 })
}

export async function POST(request: Request, ctx: { params: Promise<{ resource: string }> }) {
  const user = authed(request)
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

    db.prepare("INSERT OR REPLACE INTO scans (id, user_id, date, dish, result, created_at) VALUES (?, ?, ?, ?, ?, ?)").run(
      scan.id,
      user.id,
      scan.date,
      scan.dish,
      JSON.stringify(scan.result).slice(0, 100_000),
      Date.now(),
    )
    return Response.json({ ok: true })
  }

  if (resource === "delete-all-data") {
    const limit = rateLimit(`delete:${user.id}`, 3, 60 * 60 * 1000)
    if (!limit.ok) return Response.json({ error: "Too many requests" }, { status: 429 })

    db.exec("BEGIN")
    try {
      for (const table of ["account", "day_logs", "scans", "events", "health"]) {
        db.prepare(`DELETE FROM ${table} WHERE user_id = ?`).run(user.id)
      }
      db.exec("COMMIT")
    } catch (e) {
      db.exec("ROLLBACK")
      throw e
    }
    return Response.json({ ok: true })
  }

  if (resource === "delete-account") {
    const limit = rateLimit(`delacc:${user.id}`, 3, 60 * 60 * 1000)
    if (!limit.ok) return Response.json({ error: "Too many requests" }, { status: 429 })

    destroyAllUserSessions(user.id)
    db.prepare("DELETE FROM users WHERE id = ?").run(user.id) // cascades to all user tables
    return Response.json({ ok: true }, { headers: { "Set-Cookie": `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0` } })
  }

  return Response.json({ error: "Not found" }, { status: 404 })
}
