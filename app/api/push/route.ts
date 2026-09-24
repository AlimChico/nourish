import { db, getSessionUserFromToken, rateLimit, clientIp, SESSION_COOKIE } from "@/lib/server/db"
import { pushConfigured, VAPID_PUBLIC_KEY } from "@/lib/server/push"

export const runtime = "nodejs"

function parseCookie(cookie: string, name: string): string | undefined {
  return cookie
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${name}=`))
    ?.slice(name.length + 1)
}

function auth(request: Request) {
  return getSessionUserFromToken(parseCookie(request.headers.get("cookie") ?? "", SESSION_COOKIE))
}

// GET /api/push → { configured, publicKey } — la UI masque la Row si non configuré.
export async function GET(request: Request) {
  const ip = clientIp(request)
  if (!rateLimit(`push-status:${ip}`, 30, 60_000).ok) {
    return Response.json({ error: "Too many requests" }, { status: 429 })
  }
  return Response.json({ configured: pushConfigured(), publicKey: pushConfigured() ? VAPID_PUBLIC_KEY : null })
}

// POST /api/push → enregistre (ou remplace) l'abonnement push de l'utilisateur.
type SubscribeBody = {
  endpoint?: unknown
  keys?: { p256dh?: unknown; auth?: unknown }
}

export async function POST(request: Request) {
  const ip = clientIp(request)
  if (!rateLimit(`push-sub:${ip}`, 20, 60_000).ok) {
    return Response.json({ error: "Too many requests" }, { status: 429 })
  }
  const user = await auth(request)
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 })
  if (!pushConfigured()) return Response.json({ error: "Push not configured" }, { status: 501 })

  let body: SubscribeBody
  try {
    body = (await request.json()) as SubscribeBody
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const endpoint = typeof body.endpoint === "string" ? body.endpoint : ""
  const p256dh = typeof body.keys?.p256dh === "string" ? body.keys.p256dh : ""
  const authKey = typeof body.keys?.auth === "string" ? body.keys.auth : ""
  if (!endpoint.startsWith("https://") || !p256dh || !authKey || endpoint.length > 800 || p256dh.length > 256 || authKey.length > 256) {
    return Response.json({ error: "Invalid subscription" }, { status: 400 })
  }

  await db.upsertPushSubscription(user.id, endpoint, p256dh, authKey)
  return Response.json({ ok: true })
}

// DELETE /api/push → désactive le push sur cet appareil.
export async function DELETE(request: Request) {
  const ip = clientIp(request)
  if (!rateLimit(`push-unsub:${ip}`, 30, 60_000).ok) {
    return Response.json({ error: "Too many requests" }, { status: 429 })
  }
  const user = await auth(request)
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 })

  let endpoint = ""
  try {
    const body = (await request.json()) as { endpoint?: unknown }
    if (typeof body.endpoint === "string") endpoint = body.endpoint
  } catch {
    // corps vide toléré
  }
  if (endpoint) await db.deletePushSubscription(endpoint)
  return Response.json({ ok: true })
}
