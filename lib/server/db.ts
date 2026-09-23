import { DatabaseSync } from "node:sqlite"
import { createHash, randomBytes, scrypt as _scrypt, timingSafeEqual } from "node:crypto"
import { promisify } from "node:util"
import path from "node:path"
import fs from "node:fs"

const scrypt = promisify(_scrypt) as (p: string, s: string, k: number) => Promise<Buffer>

// ---------------------------------------------------------------------------
// Connection — single shared database file
// ---------------------------------------------------------------------------

const DB_DIR = process.env.NOURISH_DB_DIR || path.join(process.cwd(), ".data")
const DB_PATH = path.join(DB_DIR, "nourish.db")

fs.mkdirSync(DB_DIR, { recursive: true })

export const db = new DatabaseSync(DB_PATH)
db.exec("PRAGMA journal_mode = WAL;")
db.exec("PRAGMA foreign_keys = ON;")
db.exec("PRAGMA busy_timeout = 3000;")

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id          TEXT PRIMARY KEY,
  email       TEXT UNIQUE NOT NULL,
  name        TEXT NOT NULL,
  password    TEXT NOT NULL,
  created_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash  TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS account (
  user_id     TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  data        TEXT NOT NULL,
  updated_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS day_logs (
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date        TEXT NOT NULL,
  data        TEXT NOT NULL,
  updated_at  INTEGER NOT NULL,
  PRIMARY KEY (user_id, date)
);

CREATE TABLE IF NOT EXISTS scans (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date        TEXT NOT NULL,
  dish        TEXT NOT NULL,
  result      TEXT NOT NULL,
  created_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS health (
  user_id     TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  data        TEXT NOT NULL,
  updated_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date        TEXT NOT NULL,
  type        TEXT NOT NULL,
  payload     TEXT,
  created_at  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_scans_user_date ON scans(user_id, date);
CREATE INDEX IF NOT EXISTS idx_events_user_date ON events(user_id, date);
`)

// ---------------------------------------------------------------------------
// Password hashing (scrypt, no native deps)
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

// ---------------------------------------------------------------------------
// Sessions — opaque tokens, only their SHA-256 is stored
// ---------------------------------------------------------------------------

export type SessionUser = { id: string; email: string; name: string }

export function createSession(userId: string): { token: string; expiresAt: Date } {
  const token = randomBytes(32).toString("base64url")
  const expiresAt = Date.now() + SESSION_TTL_MS
  db.prepare("INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)").run(
    hashToken(token),
    userId,
    Date.now(),
    expiresAt,
  )
  return { token, expiresAt: new Date(expiresAt) }
}

export function getSessionUser(token: string | undefined | null): SessionUser | null {
  if (!token) return null
  const row = db
    .prepare(
      `SELECT u.id, u.email, u.name FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ? AND s.expires_at > ?`,
    )
    .get(hashToken(token), Date.now()) as { id: string; email: string; name: string } | undefined
  return row ?? null
}

export function destroySession(token: string | undefined | null): void {
  if (!token) return
  db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(hashToken(token))
}

export function destroyAllUserSessions(userId: string): void {
  db.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId)
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30 // 30 days
export const SESSION_COOKIE = "nourish_session"

// ---------------------------------------------------------------------------
// Rate limiting — fixed-window counters held in memory
// ---------------------------------------------------------------------------

const buckets = new Map<string, { count: number; resetAt: number }>()

export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfter?: number } {
  const now = Date.now()
  const b = buckets.get(key)
  if (!b || b.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    if (buckets.size > 10_000) {
      // opportunistic cleanup
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

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

export function newId(prefix: string): string {
  return `${prefix}_${randomBytes(12).toString("hex")}`
}

export function json(data: unknown, init?: ResponseInit): Response {
  return Response.json(data, init)
}
