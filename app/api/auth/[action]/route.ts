import {
  db,
  hashPassword,
  verifyPassword,
  createSession,
  destroySession,
  destroyAllUserSessions,
  getSessionUser,
  rateLimit,
  clientIp,
  SESSION_COOKIE,
  SESSION_TTL_MS,
} from "@/lib/server/db"

export const dynamic = "force-dynamic"

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,24}$/

function sessionCookie(token: string, expiresAt: Date): string {
  const secure = process.env.NODE_ENV === "production" ? " Secure;" : ""
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax;${secure} Expires=${expiresAt.toUTCString()}`
}

function clearCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
}

export async function POST(request: Request, ctx: { params: Promise<{ action: string }> }) {
  const { action } = await ctx.params
  const ip = clientIp(request)

  try {
    if (action === "signup") {
      const limit = rateLimit(`signup:${ip}`, 5, 60 * 60 * 1000)
      if (!limit.ok) return Response.json({ error: "Too many attempts. Try again later." }, { status: 429 })

      const body = (await request.json().catch(() => null)) as { name?: string; email?: string; password?: string } | null
      const name = typeof body?.name === "string" ? body.name.trim() : ""
      const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : ""
      const password = typeof body?.password === "string" ? body.password : ""

      if (name.length < 2 || name.length > 60) return Response.json({ error: "Name must be 2–60 characters." }, { status: 400 })
      if (!EMAIL_RE.test(email)) return Response.json({ error: "Invalid email address." }, { status: 400 })
      if (password.length < 8 || password.length > 200) return Response.json({ error: "Password must be at least 8 characters." }, { status: 400 })

      const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email)
      if (existing) return Response.json({ error: "An account already exists with this email." }, { status: 409 })

      const id = `usr_${crypto.randomUUID()}`
      const hash = await hashPassword(password)
      db.prepare("INSERT INTO users (id, email, name, password, created_at) VALUES (?, ?, ?, ?, ?)").run(
        id,
        email,
        name,
        hash,
        Date.now(),
      )

      const { token, expiresAt } = createSession(id)
      return Response.json({ user: { id, email, name } }, { headers: { "Set-Cookie": sessionCookie(token, expiresAt) } })
    }

    if (action === "login") {
      const limit = rateLimit(`login:${ip}`, 10, 15 * 60 * 1000)
      if (!limit.ok) return Response.json({ error: "Too many attempts. Try again later." }, { status: 429 })

      const body = (await request.json().catch(() => null)) as { email?: string; password?: string } | null
      const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : ""
      const password = typeof body?.password === "string" ? body.password : ""
      if (!email || !password) return Response.json({ error: "Email and password required." }, { status: 400 })

      const user = db.prepare("SELECT id, email, name, password FROM users WHERE email = ?").get(email) as
        | { id: string; email: string; name: string; password: string }
        | undefined
      if (!user) return Response.json({ error: "Invalid email or password." }, { status: 401 })

      const ok = await verifyPassword(password, user.password)
      if (!ok) return Response.json({ error: "Invalid email or password." }, { status: 401 })

      const { token, expiresAt } = createSession(user.id)
      return Response.json(
        { user: { id: user.id, email: user.email, name: user.name } },
        { headers: { "Set-Cookie": sessionCookie(token, expiresAt) } },
      )
    }

    if (action === "logout") {
      const cookie = request.headers.get("cookie") ?? ""
      const token = parseCookie(cookie, SESSION_COOKIE)
      destroySession(token)
      return Response.json({ ok: true }, { headers: { "Set-Cookie": clearCookie() } })
    }

    return Response.json({ error: "Unknown action" }, { status: 404 })
  } catch (err) {
    console.error(`auth/${action} failed:`, err instanceof Error ? err.message : err)
    return Response.json({ error: "Server error" }, { status: 500 })
  }
}

export async function GET(request: Request, ctx: { params: Promise<{ action: string }> }) {
  const { action } = await ctx.params
  if (action !== "me") return Response.json({ error: "Unknown action" }, { status: 404 })
  const user = getSessionUser(parseCookie(request.headers.get("cookie") ?? "", SESSION_COOKIE))
  if (!user) return Response.json({ user: null }, { status: 401 })
  return Response.json({ user })
}

function parseCookie(cookie: string, name: string): string | undefined {
  const m = new RegExp(`(?:^|;\\s*)${name}=([^;]*)`).exec(cookie)
  return m ? decodeURIComponent(m[1]) : undefined
}

// keep destroyAllUserSessions referenced for account deletion route reuse
export const _internal = { destroyAllUserSessions }
