import {
  db,
  getSessionUserFromToken,
  safeEqualStrings,
  SESSION_COOKIE,
  selectAll,
} from "@/lib/server/db"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 30

/**
 * Administration du propriétaire — liste **tous** les clients.
 *
 * Autorisation :
 *  - header `x-admin-key: <ADMIN_KEY>`, ou
 *  - session d'un utilisateur dont l'email == ADMIN_EMAIL.
 *
 * Seul le propriétaire (ADMIN_EMAIL / ADMIN_KEY) peut lire et supprimer les
 * comptes clients. Aucun client, aucun visiteur (401 / 403). Les mots de passe
 * sont **jamais** renvoyés.
 */

const TABLES = [
  "users",
  "account",
  "day_logs",
  "scans",
  "health",
  "weight",
  "events",
  "community_recipes",
  "recipe_likes",
  "challenge_joins",
  "challenge_progress",
  "premium_codes",
  "push_subscriptions",
  "visits",
] as const

const SECRET_COLUMNS: Record<string, string[]> = {
  users: ["password"],
  sessions: ["token_hash"],
}

async function isAdmin(request: Request): Promise<boolean> {
  const adminKey = process.env.ADMIN_KEY
  const providedKey = request.headers.get("x-admin-key") ?? ""

  if (adminKey && providedKey && safeEqualStrings(providedKey, adminKey)) {
    return true
  }

  const adminEmail = (process.env.ADMIN_EMAIL || "").trim().toLowerCase()
  if (!adminEmail) return false

  try {
    const token = request.headers.get("cookie")
      ?.split(";")
      .map((c) => c.trim())
      .find((c) => c.startsWith(`${SESSION_COOKIE}=`))
      ?.slice(SESSION_COOKIE.length + 1)
    const user = await getSessionUserFromToken(token)
    return !!user && user.email.toLowerCase() === adminEmail
  } catch {
    return false
  }
}

async function serializeRows(rows: Record<string, unknown>[]): Promise<
  Record<string, unknown>[]
> {
  const out: Record<string, unknown>[] = []
  for (const row of rows) {
    const copy: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(row)) {
      if (SECRET_COLUMNS[key]) continue
      copy[key] = value
    }
    out.push(copy)
  }
  return out
}

export async function GET(request: Request) {
  if (!(await isAdmin(request))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const users = await selectAll("users", 200)
    const result = await serializeRows(users)
    return Response.json({ ok: true, clients: result }, { status: 200 })
  } catch (err) {
    console.error("admin/clients failed:", err instanceof Error ? err.message : err)
    return Response.json({ error: "Server error" }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  if (!(await isAdmin(request))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = (await request.json().catch(() => null)) as {
    email?: string
    userId?: string
  } | null

  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : ""
  const userId = typeof body?.userId === "string" ? body.userId : ""

  if (!email && !userId) {
    return Response.json({ error: "Email or userId required" }, { status: 400 })
  }

  try {
    if (email) {
      const find = await db.findUserByEmail(email)
      if (!find) {
        return Response.json({ error: "Client not found" }, { status: 404 })
      }
      await db.deleteUser(find.id)
    } else {
      const find = await db.findUserById(userId)
      if (!find) {
        return Response.json({ error: "Client not found" }, { status: 404 })
      }
      await db.deleteUser(find.id)
    }
    return Response.json({ ok: true, deleted: email || userId })
  } catch (err) {
    console.error("admin/clients DELETE failed:", err instanceof Error ? err.message : err)
    return Response.json({ error: "Server error" }, { status: 500 })
  }
}
