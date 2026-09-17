// Only cards and profiles are ever written with the signed-in user's role.
//
// WHAT THIS EXISTS BECAUSE OF. Migration 085 revoked INSERT, UPDATE and DELETE
// from authenticated on every table in public except those two, and from anon
// on all of them. That lives in the database, so nothing in this repo can see
// it, and the failure it guards against is quiet: somebody adds a write to a
// new table from a client component or from a server route holding the user's
// client, it works against any database where 085 has not run, and it fails in
// production with "permission denied for table X".
//
// THE RULE IS ABOUT WHICH CLIENT, NOT WHERE THE CODE LIVES. createClient()
// runs as the signed-in user whether it is called from a page, a route handler
// or a server action. Only createServiceClient() / createAdminClient with
// SERVICE_ROLE_KEY escapes the grants. A route handler is not privileged for
// being a route handler, and that is the assumption this checks.
//
// If a new write genuinely needs the user's own role, the answer is a column
// grant in a migration, the way 083 and 084 did it, not a wider table grant.
//
// Run: node scripts/check-write-roles.mjs

import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

const LF = String.fromCharCode(10)
const MIGRATION = 'supabase/migrations/085_close_writes_on_every_other_table.sql'

// The two the browser writes, and the only two with column grants to allow it.
const BROWSER_WRITES = ['cards', 'profiles']

let fail = 0
const bad = (msg) => { console.error(`  FAIL ${msg}`); fail++ }

const read = (p) => {
  try { return readFileSync(p, 'utf8').replace(new RegExp(String.fromCharCode(13), 'g'), '') }
  catch { return null }
}

const code = (s) => s
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split(LF).map(l => l.replace(/\/\/.*$/, '')).join(LF)

function walk(dir, out = []) {
  let entries
  try { entries = readdirSync(dir) } catch { return out }
  for (const e of entries) {
    if (e === 'node_modules' || e === '.next' || e.startsWith('.')) continue
    const p = join(dir, e)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(ts|tsx)$/.test(p)) out.push(p.split('\\').join('/'))
  }
  return out
}

// ── 1. The migration still says what this guard assumes ─────────────────────
const sql = read(MIGRATION)
if (!sql) {
  bad(`${MIGRATION} is missing, so the revoke this guard protects was never made`)
} else {
  const body = sql.split(LF).map(l => l.replace(/^\s*--.*$/, '')).join(LF)
  if (!/revoke insert, update, delete on public\.%I from authenticated/.test(body)) {
    bad(`${MIGRATION} no longer revokes writes from authenticated`)
  }
  if (!/revoke insert, update, delete on public\.%I from anon/.test(body)) {
    bad(`${MIGRATION} no longer revokes writes from anon`)
  }
  for (const t of BROWSER_WRITES) {
    if (!new RegExp(`'${t}'`).test(body)) {
      bad(`${MIGRATION} no longer skips ${t}, so the column grants 083 and 084 set would be revoked and ${t === 'cards' ? 'the card editor' : 'signup'} would break`)
    }
  }
}

// ── 2. Nothing writes another table with the user's client ──────────────────
const files = ['app', 'components', 'lib', 'hooks', 'utils'].flatMap(d => walk(d))

// Local factories that return a service-role client. Found rather than
// hardcoded, so a new one does not read as a user client and fail this.
const ADMIN_FACTORIES = new Set(['createAdminClient', 'createServiceClient', 'createServiceRoleClient'])
for (const f of files) {
  const src = code(read(f) || '')
  for (const m of src.matchAll(/export\s+(?:async\s+)?function\s+(\w+)\s*\([^)]*\)\s*\{([\s\S]{0,400}?)\n\}/g)) {
    if (/SERVICE_ROLE_KEY/.test(m[2])) ADMIN_FACTORIES.add(m[1])
  }
}

const offenders = []
for (const f of files) {
  const raw = read(f) || ''
  const src = code(raw)
  const isClient = /^\s*['"]use client['"]/m.test(raw)

  const role = {}
  for (const m of src.matchAll(/(?:const|let)\s+(\w+)\s*(?::[^=]+)?=\s*(?:await\s+)?(\w+)\s*\(/g)) {
    const [, name, fn] = m
    if (ADMIN_FACTORIES.has(fn)) role[name] = 'admin'
    else if (fn === 'createClient') role[name] = 'user'
  }
  // A helper taking the client as a parameter: the CALLER decides, so the name
  // proves nothing and this cannot be judged here. Every such helper in the
  // codebase is called with a service-role client; that is checked by reading
  // the call sites, not by this guard.
  for (const m of src.matchAll(/function\s+\w+\s*\(\s*\n?\s*(\w+)\s*:\s*(?:any|SupabaseClient)/g)) {
    role[m[1]] ??= 'param'
  }

  // ANYTHING may sit between .from() and the verb, not just whitespace. The
  // first version of this required them to be adjacent and so missed
  //     (supabase.from('card_events') as any).insert({...})
  // in app/api/analytics/route.ts, which is written with the visitor's own
  // client. The guard passed, migration 085 revoked the grant, and card view
  // tracking broke in production. A TypeScript cast is the common case; a
  // wrapping paren or a line break is the same problem.
  for (const m of src.matchAll(/(\w+)\s*\n?\s*\.from\(\s*([^)]+?)\s*\)[\s\S]{0,40}?\.(insert|update|upsert|delete)\s*\(/g)) {
    const [, recv, tableExpr, verb] = m
    const kind = isClient ? 'user' : role[recv]
    if (kind !== 'user') continue

    const tables = [...tableExpr.matchAll(/'([a-z_]+)'/g)].map(x => x[1])
    const line = src.slice(0, m.index).split(LF).length
    if (!tables.length) {
      offenders.push(`${f}:${line} .${verb}() on a table this cannot read, so nobody can tell whether the user may write it`)
      continue
    }
    for (const t of tables) {
      if (!BROWSER_WRITES.includes(t)) offenders.push(`${f}:${line} .${verb}() on ${t}`)
    }
  }
}

for (const o of offenders) {
  bad(
    `${o} with the user's own client. Migration 085 revoked that, so it fails in production with ` +
    `"permission denied". Use a server route with the service role, or add a column grant in a migration.`,
  )
}

if (fail) {
  console.error(`${LF}check-write-roles: ${fail} failure(s).`)
  process.exit(1)
}
console.log(
  'check-write-roles: cards and profiles are the only tables written with the signed-in user\'s role, so migration ' +
  '085 can hold every other table closed to both anon and authenticated without breaking a write the app makes.',
)
