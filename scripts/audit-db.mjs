// AUDIT EN LECTURE SEULE (aucun INSERT/UPDATE/DELETE/DDL) — base de production.
import postgres from "postgres"

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL || ""
if (!url) {
  console.error("NO_DATABASE_URL")
  process.exit(1)
}
const sql = postgres(url, { prepare: false, max: 2, idle_timeout: 5, connect_timeout: 10 })
const out = {}

const host = (() => {
  try {
    return new URL(url).host.replace(/:[0-9]+$/, "")
  } catch {
    return "?"
  }
})()

// 1) Tables + volumétrie
const tables = await sql`
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'public' ORDER BY table_name`
out.host = host
out.tables = []
for (const t of tables) {
  const [c] = await sql`SELECT count(*)::int AS n FROM ${sql(t.table_name)}`
  out.tables.push({ table: t.table_name, rows: c.n })
}

// 2) Orphelins : lignes dont le user_id ne correspond à aucun compte
const fkTables = [
  "sessions",
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
  "push_subscriptions",
]
out.orphans = {}
for (const t of fkTables) {
  const [r] = await sql`
    SELECT count(*)::int AS n FROM ${sql(t)} t
    LEFT JOIN users u ON u.id = t.user_id
    WHERE t.user_id IS NOT NULL AND u.id IS NULL`
  out.orphans[t] = r.n
}
const [visitOrphans] = await sql`
  SELECT count(*)::int AS n FROM visits v
  LEFT JOIN users u ON u.id = v.user_id
  WHERE v.user_id IS NOT NULL AND u.id IS NULL`
out.orphans.visits_user_id_inconnu = visitOrphans.n

// 3) Doublons
const [dupEmail] = await sql`
  SELECT count(*)::int AS n FROM (
    SELECT lower(email) e FROM users GROUP BY lower(email) HAVING count(*) > 1
  ) x`
const [dupName] = await sql`
  SELECT count(*)::int AS n FROM (
    SELECT id FROM users GROUP BY id HAVING count(*) > 1
  ) y`
const [dupDay] = await sql`
  SELECT count(*)::int AS n FROM (
    SELECT user_id, date FROM day_logs GROUP BY user_id, date HAVING count(*) > 1
  ) z`
const [dupRecipe] = await sql`
  SELECT count(*)::int AS n FROM (
    SELECT user_id, lower(title) t FROM community_recipes GROUP BY user_id, lower(title) HAVING count(*) > 1
  ) w`
const [dupEndpoint] = await sql`
  SELECT count(*)::int AS n FROM (
    SELECT endpoint FROM push_subscriptions GROUP BY endpoint HAVING count(*) > 1
  ) p`
const [dupAccount] = await sql`
  SELECT count(*)::int AS n FROM (
    SELECT user_id FROM account GROUP BY user_id HAVING count(*) > 1
  ) a`
out.duplicates = {
  meme_email_insensible_casse: dupEmail.n,
  meme_id_utilisateur: dupName.n,
  meme_jour_meme_user: dupDay.n,
  meme_recette_meme_user: dupRecipe.n,
  meme_endpoint_push: dupEndpoint.n,
  compte_double: dupAccount.n,
}

// 4) Cohérence des comptes / sessions
const [noAccount] = await sql`
  SELECT count(*)::int AS n FROM users u LEFT JOIN account a ON a.user_id = u.id WHERE a.user_id IS NULL`
const [expired] = await sql`SELECT count(*)::int AS n FROM sessions WHERE expires_at < ${Date.now()}`
const [totalSessions] = await sql`SELECT count(*)::int AS n FROM sessions`
const [users] = await sql`SELECT count(*)::int AS n FROM users`
out.comptes = {
  utilisateurs: users.n,
  sans_ligne_account: noAccount.n,
  sessions_total: totalSessions.n,
  sessions_expirees_non_purgees: expired.n,
}

// 5) Comptes de test / démo
const testRows = await sql`
  SELECT id, email, name, created_at FROM users
  WHERE email ILIKE '%test%' OR email ILIKE '%demo%' OR email ILIKE '%example%' OR name ILIKE '%test%'
  ORDER BY created_at`
out.comptes_de_test = testRows.map((r) => ({ email: r.email, name: r.name }))

// 6) Intégrité JSON des payloads (corruption)
const [badDay] = await sql`
  SELECT count(*)::int AS n FROM day_logs
  WHERE data IS NULL OR data = '' OR left(ltrim(data), 1) NOT IN ('{', '[')`
const [badAccount] = await sql`
  SELECT count(*)::int AS n FROM account
  WHERE data IS NULL OR data = '' OR left(ltrim(data), 1) NOT IN ('{', '[')`
out.json_invalide = { day_logs: badDay.n, account: badAccount.n }

// 7) Codes premium incohérents
const [overUsed] = await sql`SELECT count(*)::int AS n FROM premium_codes WHERE uses > max_uses`
const [codes] = await sql`SELECT count(*)::int AS n FROM premium_codes`
out.premium = { codes: codes.n, surconsommes: overUsed.n }

// 8) Index existants + usage réel (quelles tables scannent séquentiellement)
const idx = await sql`
  SELECT tablename, indexname FROM pg_indexes WHERE schemaname = 'public'
  ORDER BY tablename, indexname`
out.index = idx.map((r) => `${r.tablename}.${r.indexname}`)
const usage = await sql`
  SELECT relname, seq_scan::int, idx_scan::int, n_live_tup::int
  FROM pg_stat_user_tables
  WHERE schemaname = 'public' ORDER BY seq_scan DESC LIMIT 12`
out.scan_stats = usage.map((r) => ({ table: r.relname, seq_scan: r.seq_scan, idx_scan: r.idx_scan, rows: r.n_live_tup }))

// 9) Contraintes FK réellement présentes en base (et non seulement dans le code)
const fks = await sql`
  SELECT tc.table_name, kcu.column_name, ccu.table_name AS ref_table
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu ON kcu.constraint_name = tc.constraint_name
  JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
  WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
  ORDER BY tc.table_name`
out.foreign_keys = fks.map((r) => `${r.table_name}.${r.column_name} → ${r.ref_table}`)

console.log(JSON.stringify(out, null, 2))
await sql.end()
