import { createSession, db, hashPassword, rateLimit, clientIp, SESSION_COOKIE, safeEqualStrings } from "@/lib/server/db"

export const dynamic = "force-dynamic"

/**
 * OAuth Google / Apple — SÉCURISÉ PAR DÉFAUT :
 * Activé UNIQUEMENT si les variables d'environnement sont configurées côté Vercel :
 *   GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET  (Google Cloud Console → OAuth consent)
 *   APPLE_CLIENT_ID / APPLE_CLIENT_SECRET    (Apple Developer → Services ID + key)
 * Sans ces variables, l'API répond 501 et l'UI cache les boutons.
 *
 * Flux (code d'autorisation classique côté serveur, pas de token côté client) :
 *   GET  /api/auth/oauth/google        → redirect vers Google
 *   GET  /api/auth/oauth/google?code=… → échange du code, session Sahtek, redirect /
 */

function oauthConfigured(): { google: boolean; apple: boolean } {
  return {
    google: !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET,
    apple: !!process.env.APPLE_CLIENT_ID && !!process.env.APPLE_CLIENT_SECRET,
  }
}

function baseUrl(request: Request): string {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL
  if (envUrl) return envUrl.replace(/\/$/, "")
  const proto = request.headers.get("x-forwarded-proto") ?? "https"
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? ""
  return `${proto}://${host}`
}

function sessionCookie(token: string, expiresAt: Date): string {
  const secure = process.env.NODE_ENV === "production" ? " Secure;" : ""
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax;${secure} Expires=${expiresAt.toUTCString()}`
}

const stateCookie = "nourish_oauth_state"

async function exchangeGoogle(code: string, request: Request): Promise<{ email: string; name: string } | null> {
  const redirectUri = `${baseUrl(request)}/api/auth/oauth/google`
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  })
  if (!tokenRes.ok) return null
  const tokens = (await tokenRes.json()) as { access_token?: string }
  if (!tokens.access_token) return null
  const infoRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { authorization: `Bearer ${tokens.access_token}` },
  })
  if (!infoRes.ok) return null
  const info = (await infoRes.json()) as { email?: string; name?: string }
  if (!info.email) return null
  return { email: info.email.toLowerCase(), name: info.name ?? info.email.split("@")[0] }
}

async function exchangeApple(code: string, request: Request): Promise<{ email: string; name: string } | null> {
  // Apple renvoie l'identité dans l'id_token (JWT signé). On vérifie la signature publique Apple.
  const redirectUri = `${baseUrl(request)}/api/auth/oauth/apple`
  const tokenRes = await fetch("https://appleid.apple.com/auth/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.APPLE_CLIENT_ID!,
      client_secret: process.env.APPLE_CLIENT_SECRET!, // JWT ES256 signé avec la clé Apple
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  })
  if (!tokenRes.ok) return null
  const tokens = (await tokenRes.json()) as { id_token?: string }
  if (!tokens.id_token) return null
  // Vérifie l'id_token via les clés publiques Apple (JWKS).
  try {
    const { createRemoteJWKSet, jwtVerify } = await import("jose")
    const JWKS = createRemoteJWKSet(new URL("https://appleid.apple.com/auth/keys"))
    const { payload } = await jwtVerify(tokens.id_token, JWKS, {
      issuer: "https://appleid.apple.com",
      audience: process.env.APPLE_CLIENT_ID,
    })
    if (typeof payload.email !== "string") return null
    return { email: payload.email.toLowerCase(), name: typeof payload.name === "string" ? payload.name : payload.email.split("@")[0] }
  } catch {
    return null
  }
}

export async function GET(request: Request, ctx: { params: Promise<{ provider: string }> }) {
  const { provider } = await ctx.params
  const cfg = oauthConfigured()
  const url = new URL(request.url)

  if (provider === "google" && !cfg.google) {
    return Response.json({ error: "Google sign-in not configured — set GOOGLE_CLIENT_ID/SECRET in Vercel env." }, { status: 501 })
  }
  if (provider === "apple" && !cfg.apple) {
    return Response.json({ error: "Apple sign-in not configured — set APPLE_CLIENT_ID/SECRET in Vercel env." }, { status: 501 })
  }
  if (provider !== "google" && provider !== "apple") {
    return Response.json({ error: "Unknown provider" }, { status: 404 })
  }

  const ip = clientIp(request)
  const limit = rateLimit(`oauth:${ip}`, 20, 60 * 1000)
  if (!limit.ok) return Response.json({ error: "Too many requests" }, { status: 429 })

  const redirectBase = baseUrl(request)
  const code = url.searchParams.get("code")
  const state = url.searchParams.get("state")
  const cookies = request.headers.get("cookie") ?? ""

  if (!code) {
    // Étape 1 : redirect vers le fournisseur avec state anti-CSRF (cookie double-submit).
    const state = crypto.randomUUID()
    const redirect =
      provider === "google"
        ? `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
            client_id: process.env.GOOGLE_CLIENT_ID!,
            redirect_uri: `${redirectBase}/api/auth/oauth/google`,
            response_type: "code",
            scope: "openid email profile",
            state,
            prompt: "select_account",
          })}`
        : `https://appleid.apple.com/auth/authorize?${new URLSearchParams({
            client_id: process.env.APPLE_CLIENT_ID!,
            redirect_uri: `${redirectBase}/api/auth/oauth/apple`,
            response_type: "code",
            scope: "name email",
            state,
            response_mode: "form_post", // Apple POSTe le code — géré ci-dessous
          })}`
    return new Response(null, {
      status: 302,
      headers: { Location: redirect, "Set-Cookie": `${stateCookie}=${state}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600` },
    })
  }

  // Apple utilise response_mode=form_post → POST sur cette même route.
  if (url.searchParams.get("error") || (provider === "apple" && request.method === "GET" && !state && cookies.includes("apple_flow"))) {
    return Response.redirect(`${redirectBase}/?oauth=error`, 302)
  }

  // Étape 2 : vérifier le state (cookie posé à l'étape 1).
  const m = new RegExp(`(?:^|;\\s*)${stateCookie}=([^;]*)`).exec(cookies)
  const cookieState = m ? decodeURIComponent(m[1]) : ""
  if (!cookieState || !state || !safeEqualStrings(cookieState, state)) {
    return Response.redirect(`${redirectBase}/?oauth=state_error`, 302)
  }

  // Étape 3 : échanger le code contre l'identité.
  const identity = provider === "google" ? await exchangeGoogle(code, request) : await exchangeApple(code, request)
  if (!identity) return Response.redirect(`${redirectBase}/?oauth=error`, 302)

  // Étape 4 : upsert utilisateur Sahtek (e-mails OAuth = vérifiés par le fournisseur).
  let user = await db.findUserByEmail(identity.email)
  if (!user) {
    const id = `usr_${crypto.randomUUID()}`
    try {
      // Mot de passe aléatoire introuvable : le compte n'est accessible QUE via OAuth.
      await db.insertUser(id, identity.email, identity.name.slice(0, 60), await hashPassword(crypto.randomUUID()))
      user = { id, email: identity.email, name: identity.name, password: "" }
    } catch {
      return Response.redirect(`${redirectBase}/?oauth=error`, 302)
    }
  }
  if (!user) return Response.redirect(`${redirectBase}/?oauth=error`, 302)

  // Étape 5 : session Sahtek + redirect vers l'app.
  const { token, expiresAt } = await createSession(user.id)
  return new Response(null, {
    status: 302,
    headers: {
      Location: `${redirectBase}/`,
      "Set-Cookie": sessionCookie(token, expiresAt),
    },
  })
}

/** Apple POSTe son formulaire sur la même URL (response_mode=form_post). */
export async function POST(request: Request, ctx: { params: Promise<{ provider: string }> }) {
  const { provider } = await ctx.params
  if (provider !== "apple") return Response.json({ error: "Not found" }, { status: 404 })
  const form = await request.formData().catch(() => null)
  const code = form?.get("code")
  if (typeof code !== "string" || !code) {
    return Response.redirect(`${baseUrl(request)}/?oauth=error`, 302)
  }
  // Réutilise la logique GET avec ?code=…
  const url = new URL(request.url)
  url.searchParams.set("code", code)
  const getReq = new Request(url.toString(), { headers: request.headers, method: "GET" })
  return GET(getReq, ctx)
}
