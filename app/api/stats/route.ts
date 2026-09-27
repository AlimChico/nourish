import { safeEqualStrings, usingPostgres } from "@/lib/server/db"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * Stats de visite — STRICTEMENT réservées au propriétaire de l'app :
 *  - soit le header `x-admin-key: <ADMIN_KEY>` (comme /api/db-setup côté tooling),
 *  - soit la session d'un utilisateur dont l'email == ADMIN_EMAIL.
 * Les autres utilisateurs reçoivent 403, les anonymes 401.
 */

export async function GET(request: Request) {
  const adminKey = process.env.ADMIN_KEY
  const adminEmail = (process.env.ADMIN_EMAIL || "").trim().toLowerCase()

  let authorized = false
  const provided = request.headers.get("x-admin-key") ?? ""
  if (adminKey && provided && safeEqualStrings(provided, adminKey)) authorized = true
  if (!authorized && adminEmail) {
    try {
      const { getSessionUserFromToken, SESSION_COOKIE } = await import("@/lib/server/db")
      const cookie = request.headers.get("cookie") ?? ""
      const token = cookie
        .split(";")
        .map((c) => c.trim())
        .find((c) => c.startsWith(`${SESSION_COOKIE}=`))
        ?.slice(SESSION_COOKIE.length + 1)
      const user = await getSessionUserFromToken(token)
      if (user && user.email.toLowerCase() === adminEmail) authorized = true
    } catch {
      // pas de session → anonyme
    }
  }

  if (!authorized) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { db } = await import("@/lib/server/db")
    const stats = await db.visitsStats()
    return Response.json({ backend: usingPostgres ? "postgres" : "sqlite", ...stats })
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "stats failed" }, { status: 500 })
  }
}
