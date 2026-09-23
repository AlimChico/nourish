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
import { promisify } from "node:util"
import path from "node:path"
import fs from "node:fs"

const scrypt = promisify(_scrypt) as (p: string, s: string, k: number) => Promise<Buffer>

// ---------------------------------------------------------------------------
// Password hashing (shared by both backends)
// ---------------------------------------------------------------------------

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex")
  const hash = await scrypt(password, salt, 64)
  return `${salt}:${hash.toString("hex")}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hex] = stored.split(":")
  if (!salt || !hex) return false
  const hash = await scrypt(password, salt, 64)
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

  async insertUser(id: string, email: string, name: string, passwordHash: string): Promise<void> {
    const now = Date.now()
    if (usingPostgres) {
      await sql`INSERT INTO users (id, email, name, password, created_at) VALUES (${id}, ${email}, ${name}, ${passwordHash}, ${now})`
      return
    }
    sqlite!.prepare("INSERT INTO users (id, email, name, password, created_at) VALUES (?, ?, ?, ?, ?)").run(id, email, name, passwordHash, now)
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

  async deleteUser(userId: string): Promise<void> {
    if (usingPostgres) {
      await sql`DELETE FROM users WHERE id = ${userId}`
      return
    }
    sqlite!.prepare("DELETE FROM users WHERE id = ?").run(userId)
  },

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
}

// ---------------------------------------------------------------------------
// Sessions / tokens / rate limiting
// ---------------------------------------------------------------------------

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30 // 30 days
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

export async function createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  await purgeExpiredSessions()
  const token = randomBytes(32).toString("base64url")
  const expiresAt = Date.now() + SESSION_TTL_MS
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

export function clientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for")
  if (fwd) return fwd.split(",")[0]!.trim()
  return request.headers.get("x-real-ip") || "local"
}

export function newId(prefix: string): string {
  return `${prefix}_${randomBytes(12).toString("hex")}`
}
