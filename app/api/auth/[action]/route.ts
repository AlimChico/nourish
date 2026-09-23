import {
  db,
  hashPassword,
  verifyPassword,
  createSession,
  destroySessionByToken,
  destroyAllUserSessions,
  getSessionUserFromToken,
  rateLimit,
  clientIp,
  safeEqualStrings,
  SESSION_COOKIE,
} from "@/lib/server/db"

export const dynamic = "force-dynamic"

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,24}$/

/** Reject the weakest passwords outright (still allowing passphrases). */
const WEAK_PASSWORDS = new Set([
  "password", "password1", "password123", "passw0rd", "motdepasse", "motdepasse1",
  "12345678", "123456789", "1234567890", "qwerty123", "azerty123", "letmein123",
  "iloveyou1", "admin1234", "welcome1", "sahtek123", "sahtek2026",
])

function passwordProblem(password: string): string | null {
  if (password.length < 8) return "Password must be at least 8 characters."
  if (password.length > 200) return "Password is too long."
  if (WEAK_PASSWORDS.has(password.toLowerCase())) return "This password is too common — choose a stronger one."
  if (/^(.)\1+$/.test(password)) return "This password is too weak — mix letters and numbers."
  return null
}

function sessionCookie(token: string, expiresAt: Date): string {
  const secure = process.env.NODE_ENV === "production" ? " Secure;" : ""
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax;${secure} Expires=${expiresAt.toUTCString()}`
}

function clearCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
}

function parseCookie(cookie: string, name: string): string | undefined {
  const m = new RegExp(`(?:^|;\\s*)${name}=([^;]*)`).exec(cookie)
  return m ? decodeURIComponent(m[1]) : undefined
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
      const weak = passwordProblem(password)
      if (weak) return Response.json({ error: weak }, { status: 400 })

      const existing = await db.findUserByEmail(email)
      if (existing) return Response.json({ error: "An account already exists with this email." }, { status: 409 })

      const id = `usr_${crypto.randomUUID()}`
      const hash = await hashPassword(password)
      try {
        await db.insertUser(id, email, name, hash)
      } catch (err) {
        // Concurrent signup for the same email: the UNIQUE constraint wins.
        if (err instanceof Error && /duplicate key|unique constraint/i.test(err.message)) {
          return Response.json({ error: "An account already exists with this email." }, { status: 409 })
        }
        throw err
      }

      const { token, expiresAt } = await createSession(id)
      return Response.json({ user: { id, email, name } }, { headers: { "Set-Cookie": sessionCookie(token, expiresAt) } })
    }

    if (action === "login") {
      const limit = rateLimit(`login:${ip}`, 10, 15 * 60 * 1000)
      if (!limit.ok) return Response.json({ error: "Too many attempts. Try again later." }, { status: 429 })

      const body = (await request.json().catch(() => null)) as { email?: string; password?: string } | null
      const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : ""
      const password = typeof body?.password === "string" ? body.password : ""
      if (!email || !password) return Response.json({ error: "Email and password required." }, { status: 400 })

      // Throttle per email too, so one account can't be brute-forced from many IPs.
      const emailLimit = rateLimit(`login-em:${email}`, 10, 15 * 60 * 1000)
      if (!emailLimit.ok) return Response.json({ error: "Too many attempts. Try again later." }, { status: 429 })

      const user = await db.findUserByEmail(email)
      if (!user) return Response.json({ error: "Invalid email or password." }, { status: 401 })

      const ok = await verifyPassword(password, user.password)
      if (!ok) return Response.json({ error: "Invalid email or password." }, { status: 401 })

      const { token, expiresAt } = await createSession(user.id)
      return Response.json(
        { user: { id: user.id, email: user.email, name: user.name } },
        { headers: { "Set-Cookie": sessionCookie(token, expiresAt) } },
      )
    }

    if (action === "logout") {
      await destroySessionByToken(parseCookie(request.headers.get("cookie") ?? "", SESSION_COOKIE))
      return Response.json({ ok: true }, { headers: { "Set-Cookie": clearCookie() } })
    }

    if (action === "admin-reset-password") {
      // Hidden admin mode: only works when ADMIN_EMAIL + ADMIN_KEY env vars are set.
      const adminEmail = (process.env.ADMIN_EMAIL || "").trim().toLowerCase()
      const adminKey = process.env.ADMIN_KEY || ""
      if (!adminEmail || !adminKey) return Response.json({ error: "Admin mode disabled" }, { status: 404 })

      const limit = rateLimit(`admin-reset:${ip}`, 5, 60 * 60 * 1000)
      if (!limit.ok) return Response.json({ error: "Too many attempts. Try again later." }, { status: 429 })

      const body = (await request.json().catch(() => null)) as {
        adminEmail?: string
        adminKey?: string
        userEmail?: string
        newPassword?: string
      } | null
      const aEmail = typeof body?.adminEmail === "string" ? body.adminEmail.trim().toLowerCase() : ""
      const aKey = typeof body?.adminKey === "string" ? body.adminKey : ""
      const uEmail = typeof body?.userEmail === "string" ? body.userEmail.trim().toLowerCase() : ""
      const newPassword = typeof body?.newPassword === "string" ? body.newPassword : ""

      // Timing-safe checks: exact match required, errors are generic.
      if (!safeEqualStrings(aEmail, adminEmail) || !safeEqualStrings(aKey, adminKey))
        return Response.json({ error: "Invalid admin credentials." }, { status: 401 })
      if (!EMAIL_RE.test(uEmail)) return Response.json({ error: "Invalid user email." }, { status: 400 })
      const weakReset = passwordProblem(newPassword)
      if (weakReset) return Response.json({ error: weakReset }, { status: 400 })

      const user = await db.findUserByEmail(uEmail)
      if (!user) return Response.json({ error: "No account with this email." }, { status: 404 })

      const hash = await hashPassword(newPassword)
      await db.updateUserPassword(user.id, hash)
      await destroyAllUserSessions(user.id) // kick out stolen sessions too
      return Response.json({ ok: true, name: user.name })
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
  const user = await getSessionUserFromToken(parseCookie(request.headers.get("cookie") ?? "", SESSION_COOKIE))
  if (!user) return Response.json({ user: null }, { status: 401 })
  return Response.json({ user })
}
