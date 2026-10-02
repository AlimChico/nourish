/**
 * Data layer abstraction — Postgres (Supabase) in production, SQLite locally.
 *
 * DATABASE_URL (or POSTGRES_URL) → Postgres (Supabase pooler URL works great).
 * Otherwise → SQLite file (works locally; on read-only hosts the DB lives in
 * /tmp so auth still functions, with the caveat that data is ephemeral).
 *
 * Both backends expose the same tiny async API used by the route handlers, so
 * the rest of the app never cares which one is active.
 */

import { DatabaseSync } from "node:sqlite"
import { createHash, randomBytes, scrypt as _scrypt, timingSafeEqual } from "node:crypto"
import path from "node:path"
import fs from "node:fs"

/** Wrapper scrypt compatible Node 18–24+.
 *
 * Node `crypto.scrypt` ne prend pas (password, salt, N, R, P) en positionnel.
 * Sa signature est :
 *   scrypt(password, salt, keylen, options, callback)
 *   où options = { N, R, P } et keylen = longueur du hash sortant (octets).
 *
 * Ce build Node n'expose pas la forme Promise (il lève sur tout appel sans
 * callback explicite), donc on utilise toujours le mode callback enveloppé
 * dans une Promise. Le hash sortant fait 64 octets (512 bits) — suffisant
 * pour un sel+pwd dérivé.
 */
const SCRYPT_KEYLEN = 64

async function scryptAsync(password: string, salt: string, N: number, R: number, P: number): Promise<Buffer> {
  const opts = { N, R, P }
  return new Promise((resolve, reject) => {
    _scrypt(password, salt, SCRYPT_KEYLEN, opts, (err, derivedKey) => {
      if (err) reject(err)
      else resolve(derivedKey)
    })
  })
}

// ---------------------------------------------------------------------------
// Password hashing (shared by both backends)
// ---------------------------------------------------------------------------

const SCRYPT_N = 2 ** 14 // 16 384 — coût équilibré sécurité/performance (ajuster en prod selon le CPU)
const SCRYPT_R = 8
const SCRYPT_P = 1

/** Hacher un mot de passe avec scrypt (format: N:R:P:salt:hash) */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex")
  const hash = await scryptAsync(password, salt, SCRYPT_N, SCRYPT_R, SCRYPT_P)
  return `${SCRYPT_N}:${SCRYPT_R}:${SCRYPT_P}:${salt}:${hash.toString("hex")}`
}

/** Vérifier un mot de passe — supporte le format legacy (salt:hash) et le nouveau (N:R:P:salt:hash) */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split(":")
  let N = SCRYPT_N
  let R = SCRYPT_R
  let P = SCRYPT_P
  let salt: string
  let hex: string

  if (parts.length >= 5) {
    // Format nouveau: N:R:P:salt:hash (5 parties)
    const [nRaw, rRaw, pRaw, saltPart, hexPart] = parts
    N = Math.max(1, parseInt(nRaw ?? "", 10) || SCRYPT_N)
    R = Math.max(1, parseInt(rRaw ?? "", 10) || SCRYPT_R)
    P = Math.max(1, parseInt(pRaw ?? "", 10) || SCRYPT_P)
    salt = saltPart ?? ""
    hex = hexPart ?? ""
  } else if (parts.length >= 2) {
    // Format legacy: salt:hash (N=64, R=8, P=1 par défaut dans l'ancien code)
    [salt, hex] = parts
    N = 64
    R = 8
    P = 1
  } else {
    return false
  }

  if (!salt || !hex) return false
  const hash = await scryptAsync(password, salt, N, R, P)
  const storedBuf = Buffer.from(hex, "hex")
  return hash.length === storedBuf.length && timingSafeEqual(hash, storedBuf)
}

export type SessionUser = { id: string; email: string; name: string }

// ---------------------------------------------------------------------------
// Backend selection
// ---------------------------------------------------------------------------

const DATABASE_URL =
  process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.SUPABASE_DB_URL || ""

export const usingPostgres = DATABASE_URL.length > 0

// ---------------------------------------------------------------------------
// Postgres backend (Supabase)
// ---------------------------------------------------------------------------

type PostgresClient = Awaited<ReturnType<typeof makePostgres>>

async function makePostgres(url: string) {
  const { default: postgres } = await import("postgres")
  const sql = postgres(url, { prepare: false, max: 5, idle_timeout: 20, connect_timeout: 10 })
  await sql`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    password TEXT NOT NULL,
    created_at BIGINT NOT NULL
  )`
  await sql`CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at BIGINT NOT NULL,
    expires_at BIGINT NOT NULL
  )`
  await sql`CREATE TABLE IF NOT EXISTS account (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    data TEXT NOT NULL,
    updated_at BIGINT NOT NULL
  )`
  await sql`CREATE TABLE IF NOT EXISTS day_logs (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    data TEXT NOT NULL,
    updated_at BIGINT NOT NULL,
    PRIMARY KEY (user_id, date)
  )`
  await sql`CREATE TABLE IF NOT EXISTS scans (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    dish TEXT NOT NULL,
    result TEXT NOT NULL,
    created_at BIGINT NOT NULL
  )`
  await sql`CREATE TABLE IF NOT EXISTS health (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    data TEXT NOT NULL,
    updated_at BIGINT NOT NULL
  )`
  await sql`CREATE TABLE IF NOT EXISTS weight (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    data TEXT NOT NULL,
    updated_at BIGINT NOT NULL
  )`
  await sql`CREATE TABLE IF NOT EXISTS events (
    id BIGSERIAL PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    type TEXT NOT NULL,
    payload TEXT,
    created_at BIGINT NOT NULL
  )`
  await sql`CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)`
  await sql`CREATE INDEX IF NOT EXISTS idx_scans_user_date ON scans(user_id, date)`
  await sql`CREATE INDEX IF NOT EXISTS idx_events_user_date ON events(user_id, date)`
  // Index ajoutés après audit des requêtes réelles (voir AUDIT_DB.md) :
  //  - scans(user_id, created_at DESC)   → « derniers scans » (listScans)
  //  - sessions(expires_at)              → ménage/compter les sessions actives
  //  - users(created_at DESC)            → derniers inscrits (panneau admin)
  await sql`CREATE INDEX IF NOT EXISTS idx_scans_user_created ON scans(user_id, created_at DESC)`
  await sql`CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at)`
  await sql`CREATE INDEX IF NOT EXISTS idx_users_created ON users(created_at DESC)`
  await sql`CREATE TABLE IF NOT EXISTS premium_codes (
    code TEXT PRIMARY KEY,
    months INT NOT NULL,
    max_uses INT NOT NULL DEFAULT 1,
    uses INT NOT NULL DEFAULT 0,
    created_at BIGINT NOT NULL,
    days INT
  )`
  await sql`CREATE TABLE IF NOT EXISTS community_recipes (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    author_name TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    calories INT NOT NULL,
    protein INT NOT NULL,
    carbs INT NOT NULL,
    fat INT NOT NULL,
    emoji TEXT NOT NULL DEFAULT '🥗',
    created_at BIGINT NOT NULL
  )`
  await sql`CREATE TABLE IF NOT EXISTS challenge_joins (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    challenge_key TEXT NOT NULL,
    joined_at BIGINT NOT NULL,
    PRIMARY KEY (user_id, challenge_key)
  )`
  await sql`CREATE TABLE IF NOT EXISTS challenge_progress (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    challenge_key TEXT NOT NULL,
    points INT NOT NULL DEFAULT 0,
    updated_at BIGINT NOT NULL,
    PRIMARY KEY (user_id, challenge_key)
  )`
  await sql`CREATE INDEX IF NOT EXISTS idx_recipes_created ON community_recipes(created_at DESC)`
  // Suppression d'un compte = cascade sur les enfants : sans index sur user_id,
  // Postgres scanne toute la table (recipes / likes).
  await sql`CREATE INDEX IF NOT EXISTS idx_recipes_user ON community_recipes(user_id)`
  await sql`CREATE TABLE IF NOT EXISTS recipe_likes (
    recipe_id TEXT NOT NULL REFERENCES community_recipes(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at BIGINT NOT NULL,
    PRIMARY KEY (recipe_id, user_id)
  )`
  await sql`CREATE TABLE IF NOT EXISTS push_subscriptions (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    endpoint TEXT PRIMARY KEY,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at BIGINT NOT NULL,
    last_sent_date TEXT NOT NULL DEFAULT ''
  )`
  await sql`CREATE INDEX IF NOT EXISTS idx_push_user ON push_subscriptions(user_id)`
  await sql`CREATE INDEX IF NOT EXISTS idx_likes_user ON recipe_likes(user_id)`
  // Classement des défis : filtre par challenge_key + tri par points
  // (requête du leaderboard) — la PK (user_id, challenge_key) ne peut pas servir.
  await sql`CREATE INDEX IF NOT EXISTS idx_challenge_points ON challenge_progress(challenge_key, points DESC)`
  await sql`CREATE TABLE IF NOT EXISTS visits (
    day TEXT NOT NULL,
    visitor TEXT NOT NULL,
    user_id TEXT,
    created_at BIGINT NOT NULL,
    PRIMARY KEY (day, visitor)
  )`
  return sql
}

let pgClient: PostgresClient | null = null
let pgInitPromise: Promise<PostgresClient> | null = null
async function ensurePg(): Promise<PostgresClient> {
  if (!pgClient) pgClient = await (pgInitPromise ??= makePostgres(DATABASE_URL))
  return pgClient
}

/** Tagged-template wrapper: awaits the lazy client, then runs the query. */
async function sql<T = Record<string, unknown>>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T[]> {
  const client = await ensurePg()
  return (client as unknown as (s: TemplateStringsArray, ...v: unknown[]) => Promise<T[]>)(strings, ...values)
}

// ---------------------------------------------------------------------------
// SQLite backend (local / fallback)
// ---------------------------------------------------------------------------

let sqlite: DatabaseSync | null = null
if (!usingPostgres) {
  // /tmp is writable even on read-only hosts (Vercel, some containers).
  const dir = process.env.NOURISH_DB_DIR || (fs.existsSync(process.cwd()) && canWrite(process.cwd()) ? path.join(process.cwd(), ".data") : "/tmp/nourish-data")
  try {
    fs.mkdirSync(dir, { recursive: true })
    sqlite = new DatabaseSync(path.join(dir, "nourish.db"))
  } catch {
    fs.mkdirSync("/tmp/nourish-data", { recursive: true })
    sqlite = new DatabaseSync("/tmp/nourish-data/nourish.db")
  }
  sqlite.exec("PRAGMA journal_mode = WAL;")
  sqlite.exec("PRAGMA foreign_keys = ON;")
  sqlite.exec("PRAGMA busy_timeout = 3000;")
  sqlite.exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
  password TEXT NOT NULL, created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS account (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  data TEXT NOT NULL, updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS day_logs (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, date TEXT NOT NULL,
  data TEXT NOT NULL, updated_at INTEGER NOT NULL, PRIMARY KEY (user_id, date)
);
CREATE TABLE IF NOT EXISTS scans (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date TEXT NOT NULL, dish TEXT NOT NULL, result TEXT NOT NULL, created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS health (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  data TEXT NOT NULL, updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS weight (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  data TEXT NOT NULL, updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date TEXT NOT NULL, type TEXT NOT NULL, payload TEXT, created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_scans_user_date ON scans(user_id, date);
CREATE INDEX IF NOT EXISTS idx_events_user_date ON events(user_id, date);
CREATE INDEX IF NOT EXISTS idx_scans_user_created ON scans(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_users_created ON users(created_at DESC);
CREATE TABLE IF NOT EXISTS premium_codes (
  code TEXT PRIMARY KEY, months INTEGER NOT NULL, max_uses INTEGER NOT NULL DEFAULT 1,
  uses INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, days INTEGER
);
CREATE TABLE IF NOT EXISTS community_recipes (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL, title TEXT NOT NULL, description TEXT NOT NULL,
  calories INTEGER NOT NULL, protein INTEGER NOT NULL, carbs INTEGER NOT NULL, fat INTEGER NOT NULL,
  emoji TEXT NOT NULL DEFAULT '🥗', created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS challenge_joins (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, challenge_key TEXT NOT NULL,
  joined_at INTEGER NOT NULL, PRIMARY KEY (user_id, challenge_key)
);
CREATE TABLE IF NOT EXISTS challenge_progress (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, challenge_key TEXT NOT NULL,
  points INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL, PRIMARY KEY (user_id, challenge_key)
);
CREATE INDEX IF NOT EXISTS idx_recipes_created ON community_recipes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_recipes_user ON community_recipes(user_id);
CREATE TABLE IF NOT EXISTS recipe_likes (
  recipe_id TEXT NOT NULL REFERENCES community_recipes(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL, PRIMARY KEY (recipe_id, user_id)
);
CREATE TABLE IF NOT EXISTS push_subscriptions (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, endpoint TEXT PRIMARY KEY,
  p256dh TEXT NOT NULL, auth TEXT NOT NULL, created_at INTEGER NOT NULL,
  last_sent_date TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_push_user ON push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_likes_user ON recipe_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_challenge_points ON challenge_progress(challenge_key, points DESC);
CREATE TABLE IF NOT EXISTS visits (
  day TEXT NOT NULL, visitor TEXT NOT NULL, user_id TEXT,
  created_at INTEGER NOT NULL, PRIMARY KEY (day, visitor)
);
`)
}

function canWrite(dir: string): boolean {
  try {
    fs.accessSync(dir, fs.constants.W_OK)
    return true
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// Unified API (async — Postgres requires it)
// ---------------------------------------------------------------------------

/**
 * Lecture brute d'une table complète — réservée à l'export de sauvegarde admin.
 * Le nom de table est validé par une allowlist stricte (aucune interpolation
 * libre : pas d'injection possible), et la limite borne la taille du dump.
 */
export async function selectAll(table: string, limit = 20000): Promise<Record<string, unknown>[]> {
  if (!/^[a-z_]{1,32}$/.test(table)) return []
  const max = Math.max(1, Math.min(50000, Math.floor(limit)))
  if (usingPostgres) {
    const client = await ensurePg()
    const rows = await (client as unknown as { unsafe: (q: string) => Promise<Record<string, unknown>[]> }).unsafe(
      `SELECT * FROM ${table} ORDER BY 1 LIMIT ${max}`,
    )
    return Array.isArray(rows) ? rows : []
  }
  return sqlite!.prepare(`SELECT * FROM ${table} ORDER BY 1 LIMIT ?`).all(max) as Record<string, unknown>[]
}

export const db = {
  async findUserByEmail(email: string): Promise<{ id: string; email: string; name: string; password: string } | null> {
    if (usingPostgres) {
      const rows = (await sql`SELECT id, email, name, password FROM users WHERE email = ${email} LIMIT 1`) as unknown as {
        id: string
        email: string
        name: string
        password: string
      }[]
      return rows[0] ?? null
    }
    const row = sqlite!.prepare("SELECT id, email, name, password FROM users WHERE email = ?").get(email) as
      | { id: string; email: string; name: string; password: string }
      | undefined
    return row ?? null
  },

  async findUserById(id: string): Promise<{ id: string; email: string; name: string; password: string } | null> {
    if (usingPostgres) {
      const rows = (await sql`SELECT id, email, name, password FROM users WHERE id = ${id} LIMIT 1`) as unknown as {
        id: string
        email: string
        name: string
        password: string
      }[]
      return rows[0] ?? null
    }
    const row = sqlite!.prepare("SELECT id, email, name, password FROM users WHERE id = ?").get(id) as
      | { id: string; email: string; name: string; password: string }
      | undefined
    return row ?? null
  },

  async insertUser(id: string, email: string, name: string, passwordHash: string): Promise<void> {
    const now = Date.now()
    if (usingPostgres) {
      await sql`INSERT INTO users (id, email, name, password, created_at) VALUES (${id}, ${email}, ${name}, ${passwordHash}, ${now})`
      return
    }
    sqlite!.prepare("INSERT INTO users (id, email, name, password, created_at) VALUES (?, ?, ?, ?, ?)").run(id, email, name, passwordHash, now)
  },

  /** Supprimer un utilisateur (ses sessions et données liées partent en cascade). */
  async deleteUser(userId: string): Promise<void> {
    if (usingPostgres) {
      await sql`DELETE FROM users WHERE id = ${userId}`
      return
    }
    sqlite!.prepare("DELETE FROM users WHERE id = ?").run(userId)
  },

  async deleteAllSessions(userId: string): Promise<void> {
    if (usingPostgres) {
      await sql`DELETE FROM sessions WHERE user_id = ${userId}`
      return
    }
    sqlite!.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId)
  },

  async updateUserPassword(userId: string, passwordHash: string): Promise<void> {
    if (usingPostgres) {
      await sql`UPDATE users SET password = ${passwordHash} WHERE id = ${userId}`
      return
    }
    sqlite!.prepare("UPDATE users SET password = ? WHERE id = ?").run(passwordHash, userId)
  },

  // Supprimer les données d'un utilisateur (compte, journaux, scans, santé…).
  async clearUserData(userId: string): Promise<void> {
    const tables = ["account", "day_logs", "scans", "events", "health", "weight"] as const
    if (usingPostgres) {
      for (const t of tables) {
        if (t === "account") await sql`DELETE FROM account WHERE user_id = ${userId}`
        else if (t === "day_logs") await sql`DELETE FROM day_logs WHERE user_id = ${userId}`
        else if (t === "scans") await sql`DELETE FROM scans WHERE user_id = ${userId}`
        else if (t === "events") await sql`DELETE FROM events WHERE user_id = ${userId}`
        else if (t === "health") await sql`DELETE FROM health WHERE user_id = ${userId}`
        else await sql`DELETE FROM weight WHERE user_id = ${userId}`
      }
      return
    }
    for (const t of tables) sqlite!.prepare(`DELETE FROM ${t} WHERE user_id = ?`).run(userId)
  },

  /** Supprimer les sessions orphelines (sessions dont le user_id n'existe plus). */
  async purgeOrphanedSessions(): Promise<number> {
    if (usingPostgres) {
      const res = await sql`
        DELETE FROM sessions
        WHERE user_id NOT IN (SELECT id FROM users)
      `
      return Number(res.length) // ne compte pas les lignes supprimées avec postgres
    }
    const before = sqlite!.prepare("SELECT COUNT(*) AS n FROM sessions").get() as { n: number }
    sqlite!.prepare(`DELETE FROM sessions WHERE user_id NOT IN (SELECT id FROM users)`).run()
    const after = sqlite!.prepare("SELECT COUNT(*) AS n FROM sessions").get() as { n: number }
    return Number(before.n) - Number(after.n)
  },

  async getSessionUser(tokenHash: string): Promise<SessionUser | null> {
    const now = Date.now()
    if (usingPostgres) {
      const rows = (await sql`SELECT u.id, u.email, u.name FROM sessions s JOIN users u ON u.id = s.user_id
        WHERE s.token_hash = ${tokenHash} AND s.expires_at > ${now} LIMIT 1`) as unknown as SessionUser[]
      return rows[0] ?? null
    }
    const row = sqlite!
      .prepare(
        `SELECT u.id, u.email, u.name FROM sessions s JOIN users u ON u.id = s.user_id
         WHERE s.token_hash = ? AND s.expires_at > ?`,
      )
      .get(tokenHash, now) as SessionUser | undefined
    return row ?? null
  },

  // Compter les sessions actives (utilisé par adminOverview)
  async countActiveSessions(): Promise<number> {
    const now = Date.now()
    if (usingPostgres) {
      const rows = (await sql`SELECT COUNT(*)::int AS n FROM sessions WHERE expires_at > ${now}`) as unknown as { n: number }[]
      return rows[0]?.n ?? 0
    }
    const row = sqlite!.prepare("SELECT COUNT(*) AS n FROM sessions WHERE expires_at > ?").get(now) as { n: number }
    return Number(row.n)
  },

  // Purger les sessions expirées + orphelines (appelé au login)
  async cleanupSessions(): Promise<void> {
    await purgeExpiredSessions()
    await this.purgeOrphanedSessions()
  },

  async insertSession(tokenHash: string, userId: string, expiresAt: number): Promise<void> {
    if (usingPostgres) {
      await sql`INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (${tokenHash}, ${userId}, ${Date.now()}, ${expiresAt})`
      return
    }
    sqlite!.prepare("INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)").run(tokenHash, userId, Date.now(), expiresAt)
  },

  async destroySession(tokenHash: string): Promise<void> {
    if (usingPostgres) {
      await sql`DELETE FROM sessions WHERE token_hash = ${tokenHash}`
      return
    }
    sqlite!.prepare("DELETE FROM sessions WHERE token_hash = ?").run(tokenHash)
  },

  // ----- push subscriptions (Web Push digest) -----

  async upsertPushSubscription(userId: string, endpoint: string, p256dh: string, auth: string): Promise<void> {
    const now = Date.now()
    if (usingPostgres) {
      await sql`INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, created_at, last_sent_date)
        VALUES (${userId}, ${endpoint}, ${p256dh}, ${auth}, ${now}, '')
        ON CONFLICT (endpoint) DO UPDATE SET user_id = EXCLUDED.user_id, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth, last_sent_date = ''`
      return
    }
    sqlite!
      .prepare(
        `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, created_at, last_sent_date) VALUES (?, ?, ?, ?, ?, '')
         ON CONFLICT(endpoint) DO UPDATE SET user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth, last_sent_date = ''`,
      )
      .run(userId, endpoint, p256dh, auth, now)
  },

  async deletePushSubscription(endpoint: string): Promise<void> {
    if (usingPostgres) {
      await sql`DELETE FROM push_subscriptions WHERE endpoint = ${endpoint}`
      return
    }
    sqlite!.prepare("DELETE FROM push_subscriptions WHERE endpoint = ?").run(endpoint)
  },

  async listPushSubscriptions(): Promise<
    { userId: string; endpoint: string; p256dh: string; auth: string; lastSentDate: string }[]
  > {
    if (usingPostgres) {
      const rows = await sql`SELECT user_id, endpoint, p256dh, auth, last_sent_date FROM push_subscriptions`
      return rows.map((r) => ({
        userId: r.user_id as string,
        endpoint: r.endpoint as string,
        p256dh: r.p256dh as string,
        auth: r.auth as string,
        lastSentDate: r.last_sent_date as string,
      }))
    }
    const rows = sqlite!
      .prepare("SELECT user_id, endpoint, p256dh, auth, last_sent_date FROM push_subscriptions")
      .all() as { user_id: string; endpoint: string; p256dh: string; auth: string; last_sent_date: string }[]
    return rows.map((r) => ({ userId: r.user_id, endpoint: r.endpoint, p256dh: r.p256dh, auth: r.auth, lastSentDate: r.last_sent_date }))
  },

  async markPushSent(endpoint: string, date: string): Promise<void> {
    if (usingPostgres) {
      await sql`UPDATE push_subscriptions SET last_sent_date = ${date} WHERE endpoint = ${endpoint}`
      return
    }
    sqlite!.prepare("UPDATE push_subscriptions SET last_sent_date = ? WHERE endpoint = ?").run(date, endpoint)
  },

  // ----- visit tracking (ouvertures + visiteurs uniques, une ligne/visiteur/jour) -----

  async trackVisit(visitor: string, userId: string | null, day: string): Promise<void> {
    const now = Date.now()
    if (usingPostgres) {
      await sql`INSERT INTO visits (day, visitor, user_id, created_at) VALUES (${day}, ${visitor}, ${userId}, ${now})
        ON CONFLICT (day, visitor) DO UPDATE SET user_id = COALESCE(visits.user_id, EXCLUDED.user_id)`
      return
    }
    sqlite!
      .prepare(
        `INSERT INTO visits (day, visitor, user_id, created_at) VALUES (?, ?, ?, ?)
         ON CONFLICT(day, visitor) DO UPDATE SET user_id = COALESCE(user_id, excluded.user_id)`,
      )
      .run(day, visitor, userId, now)
  },

  async visitsStats(): Promise<{
    total: number
    today: number
    days7: { visits: number; visitors: number; users: number }
    daily: { day: string; visits: number; visitors: number; users: number }[]
  }> {
    const today = new Date().toISOString().slice(0, 10)
    const since7 = new Date(Date.now() - 6 * 86_400_000).toISOString().slice(0, 10)
    const map7 = (visits: number, visitors: number, users: number) => ({ visits, visitors, users })
    if (usingPostgres) {
      const tot = (await sql`SELECT COUNT(*)::int AS n FROM visits`) as unknown as { n: number }[]
      const tod = (await sql`SELECT COUNT(*)::int AS n FROM visits WHERE day = ${today}`) as unknown as { n: number }[]
      const w = (await sql`SELECT COUNT(*)::int AS visits, COUNT(DISTINCT visitor)::int AS visitors, COUNT(DISTINCT user_id)::int AS users
        FROM visits WHERE day >= ${since7}`) as unknown as { visits: number; visitors: number; users: number }[]
      const rows = (await sql`SELECT day, COUNT(*)::int AS visits, COUNT(DISTINCT visitor)::int AS visitors, COUNT(DISTINCT user_id)::int AS users
        FROM visits WHERE day >= ${since7} GROUP BY day ORDER BY day DESC LIMIT 14`) as unknown as { day: string; visits: number; visitors: number; users: number }[]
      return {
        total: tot[0]?.n ?? 0,
        today: tod[0]?.n ?? 0,
        days7: map7(Number(w[0]?.visits ?? 0), Number(w[0]?.visitors ?? 0), Number(w[0]?.users ?? 0)),
        daily: rows.map((r) => ({ day: r.day, visits: Number(r.visits), visitors: Number(r.visitors), users: Number(r.users) })),
      }
    }
    const tot = sqlite!.prepare("SELECT COUNT(*) AS n FROM visits").get() as { n: number }
    const tod = sqlite!.prepare("SELECT COUNT(*) AS n FROM visits WHERE day = ?").get(today) as { n: number }
    const w = sqlite!
      .prepare("SELECT COUNT(*) AS visits, COUNT(DISTINCT visitor) AS visitors, COUNT(DISTINCT user_id) AS users FROM visits WHERE day >= ?")
      .get(since7) as { visits: number; visitors: number; users: number }
    const rows = sqlite!
      .prepare(
        "SELECT day, COUNT(*) AS visits, COUNT(DISTINCT visitor) AS visitors, COUNT(DISTINCT user_id) AS users FROM visits WHERE day >= ? GROUP BY day ORDER BY day DESC LIMIT 14",
      )
      .all(since7) as { day: string; visits: number; visitors: number; users: number }[]
    return {
      total: Number(tot.n),
      today: Number(tod.n),
      days7: map7(Number(w.visits), Number(w.visitors), Number(w.users)),
      daily: rows.map((r) => ({ day: r.day, visits: Number(r.visits), visitors: Number(r.visitors), users: Number(r.users) })),
    }
  },

  // ----- admin stats (panel propriétaire) -----

  async adminOverview(): Promise<{
    users: { total: number; last7: number; latest: { name: string; email: string; createdAt: number }[] }
    scans: { total: number; last7: number }
    pushSubscriptions: number
    activeSessions: number
    recipes: number
    daysLogged: number
  }> {
    const since7 = Date.now() - 7 * 86_400_000
    if (usingPostgres) {
      const uT = (await sql`SELECT COUNT(*)::int AS n FROM users`) as unknown as { n: number }[]
      const u7 = (await sql`SELECT COUNT(*)::int AS n FROM users WHERE created_at >= ${since7}`) as unknown as { n: number }[]
      const uL = (await sql`SELECT name, email, created_at FROM users ORDER BY created_at DESC LIMIT 10`) as unknown as { name: string; email: string; created_at: number }[]
      const sT = (await sql`SELECT COUNT(*)::int AS n FROM scans`) as unknown as { n: number }[]
      const s7 = (await sql`SELECT COUNT(*)::int AS n FROM scans WHERE created_at >= ${since7}`) as unknown as { n: number }[]
      const p = (await sql`SELECT COUNT(*)::int AS n FROM push_subscriptions`) as unknown as { n: number }[]
      const s = (await sql`SELECT COUNT(*)::int AS n FROM sessions WHERE expires_at > ${Date.now()}`) as unknown as { n: number }[]
      const r = (await sql`SELECT COUNT(*)::int AS n FROM community_recipes`) as unknown as { n: number }[]
      const d = (await sql`SELECT COUNT(*)::int AS n FROM day_logs`) as unknown as { n: number }[]
      return {
        users: { total: uT[0]?.n ?? 0, last7: u7[0]?.n ?? 0, latest: uL.map((x) => ({ name: x.name, email: x.email, createdAt: Number(x.created_at) })) },
        scans: { total: sT[0]?.n ?? 0, last7: s7[0]?.n ?? 0 },
        pushSubscriptions: p[0]?.n ?? 0,
        activeSessions: s[0]?.n ?? 0,
        recipes: r[0]?.n ?? 0,
        daysLogged: d[0]?.n ?? 0,
      }
    }
    const q = (t: string, since?: number) =>
      since === undefined
        ? (sqlite!.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get() as { n: number })
        : (sqlite!.prepare(`SELECT COUNT(*) AS n FROM ${t} WHERE created_at >= ?`).get(since) as { n: number })
    const uL = sqlite!.prepare("SELECT name, email, created_at FROM users ORDER BY created_at DESC LIMIT 10").all() as { name: string; email: string; created_at: number }[]
    return {
      users: { total: Number(q("users").n), last7: Number(q("users", since7).n), latest: uL.map((x) => ({ name: x.name, email: x.email, createdAt: Number(x.created_at) })) },
      scans: { total: Number(q("scans").n), last7: Number(q("scans", since7).n) },
      pushSubscriptions: Number(q("push_subscriptions").n),
      activeSessions: Number((sqlite!.prepare("SELECT COUNT(*) AS n FROM sessions WHERE expires_at > ?").get(Date.now()) as { n: number }).n),
      recipes: Number(q("community_recipes").n),
      daysLogged: Number(q("day_logs").n),
    }
  },

  // ----- key/value-ish stores (account, health as JSON blobs; day_logs per date)

  async getJson(table: "account" | "health" | "weight", userId: string): Promise<unknown | null> {
    if (usingPostgres) {
      const rows =
        table === "account"
          ? await sql`SELECT data FROM account WHERE user_id = ${userId} LIMIT 1`
          : table === "health"
            ? await sql`SELECT data FROM health WHERE user_id = ${userId} LIMIT 1`
            : await sql`SELECT data FROM weight WHERE user_id = ${userId} LIMIT 1`
      return rows[0] ? JSON.parse(rows[0].data as string) : null
    }
    const row = sqlite!.prepare(`SELECT data FROM ${table} WHERE user_id = ?`).get(userId) as { data: string } | undefined
    return row ? JSON.parse(row.data) : null
  },

  async putJson(table: "account" | "health" | "weight", userId: string, data: unknown): Promise<void> {
    const now = Date.now()
    const json = JSON.stringify(data)
    if (usingPostgres) {
      if (table === "account") {
        await sql`INSERT INTO account (user_id, data, updated_at) VALUES (${userId}, ${json}, ${now})
          ON CONFLICT (user_id) DO UPDATE SET data = EXCLUDED.data, updated_at = EXCLUDED.updated_at`
      } else if (table === "health") {
        await sql`INSERT INTO health (user_id, data, updated_at) VALUES (${userId}, ${json}, ${now})
          ON CONFLICT (user_id) DO UPDATE SET data = EXCLUDED.data, updated_at = EXCLUDED.updated_at`
      } else {
        await sql`INSERT INTO weight (user_id, data, updated_at) VALUES (${userId}, ${json}, ${now})
          ON CONFLICT (user_id) DO UPDATE SET data = EXCLUDED.data, updated_at = EXCLUDED.updated_at`
      }
      return
    }
    sqlite!
      .prepare(
        `INSERT INTO ${table} (user_id, data, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
      )
      .run(userId, json, now)
  },

  /**
   * Toutes les journées journalisées d'un utilisateur (date + JSON) — base du
   * calcul d'XP/du classement. Borné à 400 jours comme `listDays`.
   */
  async listDayRows(userId: string): Promise<{ date: string; data: string }[]> {
    if (usingPostgres) {
      const rows = await sql`SELECT date, data FROM day_logs WHERE user_id = ${userId} ORDER BY date DESC LIMIT 400`
      return rows.map((r) => ({ date: String(r.date), data: String(r.data) }))
    }
    return sqlite!.prepare("SELECT date, data FROM day_logs WHERE user_id = ? ORDER BY date DESC LIMIT 400").all(userId) as {
      date: string
      data: string
    }[]
  },

  /**
   * Nom + journées de TOUS les utilisateurs ayant au moins un jour loggé —
   * utilisé par le classement XP. Volontairement borné (2000 comptes) : au-delà,
   * passer par un compteur XP matérialisé par utilisateur.
   */
  async xpRowsForAllUsers(limit = 2000): Promise<{ id: string; name: string; email: string; date: string; data: string }[]> {
    const max = Math.max(1, Math.min(5000, Math.floor(limit)))
    if (usingPostgres) {
      const rows = await sql`
        SELECT u.id, u.name, u.email, d.date, d.data
        FROM users u
        JOIN day_logs d ON d.user_id = u.id
        ORDER BY u.id
        LIMIT ${max * 400}`
      return rows.map((r) => ({
        id: String(r.id),
        name: String(r.name),
        email: String(r.email),
        date: String(r.date),
        data: String(r.data),
      }))
    }
    return sqlite!
      .prepare(
        `SELECT u.id, u.name, u.email, d.date, d.data
         FROM users u JOIN day_logs d ON d.user_id = u.id
         ORDER BY u.id LIMIT ?`,
      )
      .all(max * 400) as { id: string; name: string; email: string; date: string; data: string }[]
  },

  async getDay(userId: string, date: string): Promise<unknown | null> {
    if (usingPostgres) {
      const rows = await sql`SELECT data FROM day_logs WHERE user_id = ${userId} AND date = ${date} LIMIT 1`
      return rows[0] ? JSON.parse(rows[0].data as string) : null
    }
    const row = sqlite!.prepare("SELECT data FROM day_logs WHERE user_id = ? AND date = ?").get(userId, date) as { data: string } | undefined
    return row ? JSON.parse(row.data) : null
  },

  async putDay(userId: string, date: string, data: unknown): Promise<void> {
    const now = Date.now()
    const json = JSON.stringify(data)
    if (usingPostgres) {
      await sql`INSERT INTO day_logs (user_id, date, data, updated_at) VALUES (${userId}, ${date}, ${json}, ${now})
        ON CONFLICT (user_id, date) DO UPDATE SET data = EXCLUDED.data, updated_at = EXCLUDED.updated_at`
      return
    }
    sqlite!
      .prepare(
        `INSERT INTO day_logs (user_id, date, data, updated_at) VALUES (?, ?, ?, ?)
         ON CONFLICT(user_id, date) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
      )
      .run(userId, date, json, now)
  },

  async listDays(userId: string): Promise<unknown[]> {
    if (usingPostgres) {
      const rows = await sql`SELECT data FROM day_logs WHERE user_id = ${userId} ORDER BY date DESC LIMIT 400`
      return rows.map((r) => JSON.parse(r.data as string))
    }
    const rows = sqlite!.prepare("SELECT data FROM day_logs WHERE user_id = ? ORDER BY date DESC LIMIT 400").all(userId) as { data: string }[]
    return rows.map((r) => JSON.parse(r.data))
  },

  async putScan(scan: { id: string; userId: string; date: string; dish: string; result: unknown }): Promise<void> {
    const json = JSON.stringify(scan.result).slice(0, 100_000)
    if (usingPostgres) {
      await sql`INSERT INTO scans (id, user_id, date, dish, result, created_at) VALUES (${scan.id}, ${scan.userId}, ${scan.date}, ${scan.dish}, ${json}, ${Date.now()})
        ON CONFLICT (id) DO UPDATE SET result = EXCLUDED.result`
      return
    }
    sqlite!.prepare("INSERT OR REPLACE INTO scans (id, user_id, date, dish, result, created_at) VALUES (?, ?, ?, ?, ?, ?)").run(
      scan.id,
      scan.userId,
      scan.date,
      scan.dish,
      json,
      Date.now(),
    )
  },

  async ping(): Promise<{ ok: boolean; error?: string }> {
    try {
      if (usingPostgres) {
        await sql`SELECT 1`
        return { ok: true }
      }
      if (sqlite) {
        sqlite.prepare("SELECT 1").get()
        return { ok: true }
      }
      return { ok: false, error: "no backend" }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  },

  async listScans(userId: string): Promise<{ id: string; date: string; dish: string; result: unknown; createdAt: number }[]> {
    if (usingPostgres) {
      const rows = await sql`SELECT id, date, dish, result, created_at FROM scans WHERE user_id = ${userId} ORDER BY created_at DESC LIMIT 100`
      return rows.map((r) => ({ id: r.id as string, date: r.date as string, dish: r.dish as string, result: JSON.parse(r.result as string), createdAt: Number(r.created_at) }))
    }
    const rows = sqlite!.prepare("SELECT id, date, dish, result, created_at FROM scans WHERE user_id = ? ORDER BY created_at DESC LIMIT 100").all(userId) as {
      id: string
      date: string
      dish: string
      result: string
      created_at: number
    }[]
    return rows.map((r) => ({ id: r.id, date: r.date, dish: r.dish, result: JSON.parse(r.result), createdAt: r.created_at }))
  },

  // ----- community recipes -----

  async listRecipes(limit = 60): Promise<{ id: string; userId: string; authorName: string; title: string; description: string; calories: number; protein: number; carbs: number; fat: number; emoji: string; createdAt: number }[]> {
    if (usingPostgres) {
      const rows = (await sql`SELECT id, user_id, author_name, title, description, calories, protein, carbs, fat, emoji, created_at
        FROM community_recipes ORDER BY created_at DESC LIMIT ${limit}`) as unknown as Record<string, unknown>[]
      return rows.map((r) => ({
        id: r.id as string, userId: r.user_id as string, authorName: r.author_name as string, title: r.title as string,
        description: r.description as string, calories: Number(r.calories), protein: Number(r.protein), carbs: Number(r.carbs),
        fat: Number(r.fat), emoji: (r.emoji as string) || "🥗", createdAt: Number(r.created_at),
      }))
    }
    const rows = sqlite!.prepare("SELECT id, user_id, author_name, title, description, calories, protein, carbs, fat, emoji, created_at FROM community_recipes ORDER BY created_at DESC LIMIT ?").all(limit) as Record<string, unknown>[]
    return rows.map((r) => ({
      id: r.id as string, userId: r.user_id as string, authorName: r.author_name as string, title: r.title as string,
      description: r.description as string, calories: Number(r.calories), protein: Number(r.protein), carbs: Number(r.carbs),
      fat: Number(r.fat), emoji: (r.emoji as string) || "🥗", createdAt: Number(r.created_at),
    }))
  },

  async insertRecipe(r: { id: string; userId: string; authorName: string; title: string; description: string; calories: number; protein: number; carbs: number; fat: number; emoji: string }): Promise<void> {
    const now = Date.now()
    if (usingPostgres) {
      await sql`INSERT INTO community_recipes (id, user_id, author_name, title, description, calories, protein, carbs, fat, emoji, created_at)
        VALUES (${r.id}, ${r.userId}, ${r.authorName}, ${r.title}, ${r.description}, ${r.calories}, ${r.protein}, ${r.carbs}, ${r.fat}, ${r.emoji}, ${now})`
      return
    }
    sqlite!.prepare("INSERT INTO community_recipes (id, user_id, author_name, title, description, calories, protein, carbs, fat, emoji, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(
      r.id, r.userId, r.authorName, r.title, r.description, r.calories, r.protein, r.carbs, r.fat, r.emoji, now,
    )
  },

  async deleteRecipeIfOwner(id: string, userId: string): Promise<boolean> {
    if (usingPostgres) {
      const rows = (await sql`DELETE FROM community_recipes WHERE id = ${id} AND user_id = ${userId} RETURNING id`) as unknown as { id: string }[]
      return rows.length > 0
    }
    const res = sqlite!.prepare("DELETE FROM community_recipes WHERE id = ? AND user_id = ?").run(id, userId)
    return Number(res.changes) > 0
  },

  // ----- challenges (join + points) -----

  async joinChallenge(userId: string, challengeKey: string): Promise<void> {
    const now = Date.now()
    if (usingPostgres) {
      await sql`INSERT INTO challenge_joins (user_id, challenge_key, joined_at) VALUES (${userId}, ${challengeKey}, ${now})
        ON CONFLICT (user_id, challenge_key) DO NOTHING`
      return
    }
    sqlite!.prepare("INSERT OR IGNORE INTO challenge_joins (user_id, challenge_key, joined_at) VALUES (?, ?, ?)").run(userId, challengeKey, now)
  },

  async addChallengePoints(userId: string, challengeKey: string, points: number): Promise<void> {
    const now = Date.now()
    if (usingPostgres) {
      await sql`INSERT INTO challenge_progress (user_id, challenge_key, points, updated_at) VALUES (${userId}, ${challengeKey}, ${points}, ${now})
        ON CONFLICT (user_id, challenge_key) DO UPDATE SET points = challenge_progress.points + EXCLUDED.points, updated_at = EXCLUDED.updated_at`
      return
    }
    sqlite!.prepare(
      "INSERT INTO challenge_progress (user_id, challenge_key, points, updated_at) VALUES (?, ?, ?, ?) " +
        "ON CONFLICT(user_id, challenge_key) DO UPDATE SET points = points + excluded.points, updated_at = excluded.updated_at",
    ).run(userId, challengeKey, points, now)
  },

  async challengeLeaderboard(challengeKey: string): Promise<{ name: string; points: number; userId: string }[]> {
    if (usingPostgres) {
      const rows = (await sql`SELECT cp.user_id AS user_id, cp.points AS points, u.name AS name
        FROM challenge_progress cp JOIN users u ON u.id = cp.user_id
        WHERE cp.challenge_key = ${challengeKey} ORDER BY cp.points DESC LIMIT 50`) as unknown as Record<string, unknown>[]
      return rows.map((r) => ({ userId: r.user_id as string, points: Number(r.points), name: r.name as string }))
    }
    const rows = sqlite!.prepare(
      "SELECT cp.user_id AS user_id, cp.points AS points, u.name AS name FROM challenge_progress cp JOIN users u ON u.id = cp.user_id WHERE cp.challenge_key = ? ORDER BY cp.points DESC LIMIT 50",
    ).all(challengeKey) as Record<string, unknown>[]
    return rows.map((r) => ({ userId: r.user_id as string, points: Number(r.points), name: r.name as string }))
  },

  async challengeProgressFor(userId: string): Promise<{ challengeKey: string; points: number }[]> {
    if (usingPostgres) {
      const rows = (await sql`SELECT challenge_key, points FROM challenge_progress WHERE user_id = ${userId}`) as unknown as { challenge_key: string; points: number }[]
      return rows.map((r) => ({ challengeKey: r.challenge_key, points: Number(r.points) }))
    }
    const rows = sqlite!.prepare("SELECT challenge_key, points FROM challenge_progress WHERE user_id = ?").all(userId) as { challenge_key: string; points: number }[]
    return rows.map((r) => ({ challengeKey: r.challenge_key, points: Number(r.points) }))
  },

  async challengeJoinsFor(userId: string): Promise<string[]> {
    if (usingPostgres) {
      const rows = (await sql`SELECT challenge_key FROM challenge_joins WHERE user_id = ${userId}`) as unknown as { challenge_key: string }[]
      return rows.map((r) => r.challenge_key)
    }
    const rows = sqlite!.prepare("SELECT challenge_key FROM challenge_joins WHERE user_id = ?").all(userId) as { challenge_key: string }[]
    return rows.map((r) => r.challenge_key)
  },

  // ----- recipe likes -----

  async toggleRecipeLike(recipeId: string, userId: string): Promise<{ liked: boolean; total: number }> {
    if (usingPostgres) {
      const removed = (await sql`DELETE FROM recipe_likes WHERE recipe_id = ${recipeId} AND user_id = ${userId} RETURNING user_id`) as unknown as { user_id: string }[]
      if (removed.length === 0) {
        await sql`INSERT INTO recipe_likes (recipe_id, user_id, created_at) VALUES (${recipeId}, ${userId}, ${Date.now()}) ON CONFLICT DO NOTHING`
      }
    } else {
      const del = sqlite!.prepare("DELETE FROM recipe_likes WHERE recipe_id = ? AND user_id = ?").run(recipeId, userId)
      if (Number(del.changes) === 0) {
        sqlite!.prepare("INSERT OR IGNORE INTO recipe_likes (recipe_id, user_id, created_at) VALUES (?, ?, ?)").run(recipeId, userId, Date.now())
      }
    }
    const total = await this.countRecipeLikes(recipeId)
    const liked = await this.hasLiked(recipeId, userId)
    return { liked, total }
  },

  async countRecipeLikes(recipeId: string): Promise<number> {
    if (usingPostgres) {
      const rows = (await sql`SELECT COUNT(*)::int AS n FROM recipe_likes WHERE recipe_id = ${recipeId}`) as unknown as { n: number }[]
      return rows[0]?.n ?? 0
    }
    const row = sqlite!.prepare("SELECT COUNT(*) AS n FROM recipe_likes WHERE recipe_id = ?").get(recipeId) as { n: number }
    return row.n
  },

  async hasLiked(recipeId: string, userId: string): Promise<boolean> {
    if (usingPostgres) {
      const rows = (await sql`SELECT 1 AS x FROM recipe_likes WHERE recipe_id = ${recipeId} AND user_id = ${userId} LIMIT 1`) as unknown as { x: number }[]
      return rows.length > 0
    }
    return !!sqlite!.prepare("SELECT 1 FROM recipe_likes WHERE recipe_id = ? AND user_id = ? LIMIT 1").get(recipeId, userId)
  },

  async likesSummaryFor(userId: string): Promise<Record<string, { liked: boolean; total: number }>> {
    // One query per recipe is fine at current scale; called with ≤60 recipes.
    const recipes = await this.listRecipes(60)
    const out: Record<string, { liked: boolean; total: number }> = {}
    for (const r of recipes) {
      const [total, liked] = await Promise.all([this.countRecipeLikes(r.id), this.hasLiked(r.id, userId)])
      out[r.id] = { liked, total }
    }
    return out
  },

  // ----- premium activation codes -----

  async findPremiumCode(code: string): Promise<{ code: string; months: number; days: number | null; maxUses: number; uses: number } | null> {
    const map = (r: { code: string; months: number; days?: number | null; max_uses: number; uses: number }) => ({
      code: r.code,
      months: r.months,
      days: r.days ?? null,
      maxUses: r.max_uses,
      uses: r.uses,
    })
    if (usingPostgres) {
      const rows = (await sql`SELECT code, months, days, max_uses, uses FROM premium_codes WHERE code = ${code} LIMIT 1`) as unknown as { code: string; months: number; days: number | null; max_uses: number; uses: number }[]
      return rows[0] ? map(rows[0]) : null
    }
    const row = sqlite!.prepare("SELECT code, months, days, max_uses, uses FROM premium_codes WHERE code = ?").get(code) as { code: string; months: number; days: number | null; max_uses: number; uses: number } | undefined
    return row ? map(row) : null
  },

  async redeemPremiumCode(code: string, userId: string): Promise<{ ok: boolean; months?: number; days?: number; reason?: string }> {
    const normalized = code.trim().toUpperCase()
    const row = await this.findPremiumCode(normalized)
    if (!row) return { ok: false, reason: "Code inconnu" }
    if (row.uses >= row.maxUses) return { ok: false, reason: "Code déjà utilisé" }
    if (usingPostgres) {
      const res = (await sql`UPDATE premium_codes SET uses = uses + 1 WHERE code = ${normalized} AND uses < max_uses RETURNING months, days`) as unknown as { months: number; days: number | null }[]
      if (res.length === 0) return { ok: false, reason: "Code déjà utilisé" }
      return { ok: true, months: Number(res[0].months), days: res[0].days != null ? Number(res[0].days) : undefined }
    }
    const res = sqlite!.prepare("UPDATE premium_codes SET uses = uses + 1 WHERE code = ? AND uses < max_uses RETURNING months, days").get(normalized) as { months: number; days: number | null } | undefined
    if (!res) return { ok: false, reason: "Code déjà utilisé" }
    return { ok: true, months: Number(res.months), days: res.days != null ? Number(res.days) : undefined }
  },

  async createPremiumCode(code: string, months: number, maxUses: number, days?: number): Promise<void> {
    if (usingPostgres) {
      await sql`INSERT INTO premium_codes (code, months, max_uses, uses, created_at, days)
        VALUES (${code}, ${months}, ${maxUses}, 0, ${Date.now()}, ${days ?? null})
        ON CONFLICT (code) DO UPDATE SET months = EXCLUDED.months, max_uses = EXCLUDED.max_uses, days = EXCLUDED.days`
      return
    }
    sqlite!
      .prepare(
        "INSERT INTO premium_codes (code, months, max_uses, uses, created_at, days) VALUES (?, ?, ?, 0, ?, ?) " +
          "ON CONFLICT(code) DO UPDATE SET months = excluded.months, max_uses = excluded.max_uses, days = excluded.days",
      )
      .run(code, months, maxUses, Date.now(), days ?? null)
  },
}

// ---------------------------------------------------------------------------
// Sessions / tokens / rate limiting
// ---------------------------------------------------------------------------

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7 // 7 jours — durée raisonnable, rotation fréquente
const SESSION_MAX_LIFE_MS = 1000 * 60 * 60 * 24 * 30 // 30 j max absolu (même avec rotation)
export const SESSION_COOKIE = "nourish_session"

/** Delete expired sessions so the table stays bounded (runs on each new login). */
export async function purgeExpiredSessions(): Promise<void> {
  const now = Date.now()
  try {
    if (usingPostgres) await sql`DELETE FROM sessions WHERE expires_at < ${now}`
    else sqlite!.prepare("DELETE FROM sessions WHERE expires_at < ?").run(now)
  } catch {
    // non-fatal housekeeping
  }
}

/** Timing-safe string comparison (hashes first so lengths never leak). */
export function safeEqualStrings(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest()
  const hb = createHash("sha256").update(b).digest()
  return timingSafeEqual(ha, hb)
}

export async function createSession(userId: string, existingToken?: string): Promise<{ token: string; expiresAt: Date }> {
  await purgeExpiredSessions()
  // Rotation du token si on fournit un token existant (évite la fixation de session)
  const now = Date.now()
  let token: string
  let expiresAt: number
  if (existingToken) {
    const existing = await db.getSessionUser(hashToken(existingToken))
    if (existing?.id === userId) {
      // Réutiliser l'ID de session existant mais en régénérer le token (rotation)
      token = randomBytes(32).toString("base64url")
      const sessionRow = usingPostgres
        ? (await sql`SELECT expires_at FROM sessions WHERE token_hash = ${hashToken(existingToken)} LIMIT 1`)[0]
        : (sqlite!.prepare("SELECT expires_at FROM sessions WHERE token_hash = ?").get(hashToken(existingToken)) as { expires_at: number } | undefined)
      const existingExpiry = Number((sessionRow as { expires_at?: number } | undefined)?.expires_at ?? now)
      const maxExpiry = Math.min(existingExpiry + SESSION_TTL_MS, now + SESSION_MAX_LIFE_MS)
      expiresAt = Math.max(now + SESSION_TTL_MS, maxExpiry)
      await db.destroySession(hashToken(existingToken))
      await db.insertSession(hashToken(token), userId, expiresAt)
      return { token, expiresAt: new Date(expiresAt) }
    }
  }
  token = randomBytes(32).toString("base64url")
  expiresAt = now + SESSION_TTL_MS
  await db.insertSession(hashToken(token), userId, expiresAt)
  return { token, expiresAt: new Date(expiresAt) }
}

export async function getSessionUserFromToken(token: string | undefined | null): Promise<SessionUser | null> {
  if (!token) return null
  return db.getSessionUser(hashToken(token))
}

export async function destroySessionByToken(token: string | undefined | null): Promise<void> {
  if (!token) return
  await db.destroySession(hashToken(token))
}

export async function destroyAllUserSessions(userId: string): Promise<void> {
  await db.deleteAllSessions(userId)
}

const buckets = new Map<string, { count: number; resetAt: number }>()

export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfter?: number } {
  const now = Date.now()
  const b = buckets.get(key)
  if (!b || b.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    if (buckets.size > 10_000) {
      for (const [k, v] of buckets) if (v.resetAt < now) buckets.delete(k)
    }
    return { ok: true }
  }
  b.count += 1
  return b.count > limit ? { ok: false, retryAfter: Math.ceil((b.resetAt - now) / 1000) } : { ok: true }
}

/**
 * Lire le body d'une requête avec une limite de taille stricte (protection DoS).
 * Rejette les payloads > maxBytes avant de parser le JSON.
 */
export async function readBodyWithLimit(request: Request, maxBytes = 500_000): Promise<{ ok: boolean; data: unknown; error?: string }> {
  const contentLength = request.headers.get("content-length")
  if (contentLength && parseInt(contentLength, 10) > maxBytes) {
    return { ok: false, data: null, error: "Payload too large" }
  }
  try {
    const chunks: Uint8Array[] = []
    let total = 0
    const reader = request.body!.getReader()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (value) {
        total += value.byteLength
        if (total > maxBytes) {
          reader.cancel()
          return { ok: false, data: null, error: "Payload too large" }
        }
        chunks.push(value)
      }
    }
    const buffer = new Uint8Array(total)
    let offset = 0
    for (const c of chunks) {
      buffer.set(c, offset)
      offset += c.byteLength
    }
    const text = Buffer.from(buffer).toString("utf-8")
    try {
      return { ok: true, data: JSON.parse(text) }
    } catch {
      return { ok: false, data: null, error: "Invalid JSON" }
    }
  } catch {
    return { ok: false, data: null, error: "Request read failed" }
  }
}

export function clientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for")
  if (fwd) return fwd.split(",")[0]!.trim()
  return request.headers.get("x-real-ip") || "local"
}

export function newId(prefix: string): string {
  return `${prefix}_${randomBytes(12).toString("hex")}`
}
