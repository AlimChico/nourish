import { createHash } from "node:crypto"
import { rateLimit, clientIp, getSessionUserFromToken, SESSION_COOKIE } from "@/lib/server/db"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * Suivi de visites minimaliste, sans service tiers :
 *  - 1 ligne par visiteur et par jour (throttlé côté client à ~10 min).
 *  - Visitor = hash SHA-256 de (IP + User-Agent + sel) : suffisant pour
 *    compter des visiteurs uniques, impossible à réassocier à une personne.
 *  - user_id de session si l'utilisateur est connecté (compte des users).
 *  - Aucune donnée personnelle stockée : day, visitor (hash), user_id, date.
 */

function parseCookie(cookie: string, name: string): string | undefined {
  return cookie
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${name}=`))
    ?.slice(name.length + 1)
}

export async function POST(request: Request) {
  const ip = clientIp(request)
  if (!rateLimit(`track:${ip}`, 60, 60_000).ok) {
    return Response.json({ ok: true }) // silencieux : le tracking ne doit jamais casser l'app
  }

  const day = new Date().toISOString().slice(0, 10)
  const salt = process.env.STATS_SALT || "sahtek-visitor-salt-v1"
  const ua = request.headers.get("user-agent") ?? ""
  const visitor = createHash("sha256").update(`${salt}|${ip}|${ua}`).digest("hex").slice(0, 32)

  let userId: string | null = null
  try {
    const user = await getSessionUserFromToken(parseCookie(request.headers.get("cookie") ?? "", SESSION_COOKIE))
    userId = user?.id ?? null
  } catch {
    // visite anonyme
  }

  try {
    const { db } = await import("@/lib/server/db")
    await db.trackVisit(visitor, userId, day)
  } catch {
    // DB indisponible : on ne casse jamais l'app pour du tracking
  }
  return Response.json({ ok: true })
}
