// The browser never writes a column migration 084 took away from it.
//
// WHAT THIS EXISTS BECAUSE OF. 084 revoked INSERT/UPDATE/DELETE on cards and
// organizations from the authenticated role and granted back only what the
// browser actually writes, the same fix 083 made to profiles. That lives in
// the database, so nothing in this repo can see it - and the failure mode is
// nasty: somebody adds a client-side write of cards.addons, it works against
// any database where 084 has not been run, and it fails in production with
// "permission denied for column addons" on a code path nobody tested.
//
// So this checks the source side of the same rule. If a write here needs a
// column the browser may not have, the answer is a server route with the
// service role - /api/slug, /api/card/addons, /api/account/primary-card and
// /api/cards/restore are all that shape already - not a wider grant.
//
// A SERVER ROUTE IS NOT AUTOMATICALLY PRIVILEGED. createClient() runs as the
// signed-in user and is governed by these grants exactly like the browser.
// Only createServiceClient() / SERVICE_ROLE_KEY escapes them. This guard reads
// 'use client' files, which cannot reach the service role at all; a route that
// uses the user's client has to be reasoned about by hand.
//
// Run: node scripts/check-card-column-grants.mjs

import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

const MIGRATION = 'supabase/migrations/084_cards_and_organizations_column_grants.sql'
const LF = String.fromCharCode(10)

// Kept in step with the deny list in 084 by hand, and that is the point: if
// somebody widens the grant there, this list is the second place they have to
// argue for it.
const DENIED_UPDATE = [
  'id', 'created_at',
  'user_id', 'assigned_user_id', 'member_user_id',
  'organization_id', 'org_id', 'team_id',
  'slug', 'slug_prefix', 'slug_suffix', 'slug_user_part', 'redirect_to_slug',
  'is_primary', 'archived',
  'addons', 'view_count', 'template_locked_fields',
]

// What signup inserts, and the only reason any of these is writable at all.
const ALLOWED_INSERT = [
  'user_id', 'assigned_user_id', 'name', 'company', 'email', 'slug',
  'is_primary', 'color_theme',
]

let fail = 0
const bad = (msg) => { console.error(`  FAIL ${msg}`); fail++ }

const read = (p) => {
  try { return readFileSync(p, 'utf8').replace(new RegExp(String.fromCharCode(13), 'g'), '') }
  catch { return null }
}

/** Comments stripped, so an explanation of the rule cannot satisfy a check
 *  looking for a breach of it, and a commented-out write cannot fail one. */
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

/** The balanced {...} starting at `from`, so a nested object in a payload does
 *  not end the payload early. Returns '' if the braces never close. */
function balanced(src, from) {
  const open = src.indexOf('{', from)
  if (open < 0) return ''
  let depth = 0
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++
    else if (src[i] === '}') {
      depth--
      if (depth === 0) return src.slice(open, i + 1)
    }
  }
  return ''
}

/** Top-level keys of an object literal. Nested objects are skipped rather than
 *  read, because `{ settings: { slug: 1 } }` does not write cards.slug. */
function topLevelKeys(literal) {
  const keys = []
  let depth = 0
  let line = ''
  for (const ch of literal) {
    if (ch === '{' || ch === '[' || ch === '(') { depth++; if (depth > 1) continue }
    if (ch === '}' || ch === ']' || ch === ')') { depth--; if (depth > 0) continue }
    if (depth !== 1) continue
    if (ch === ',' || ch === LF) {
      const m = line.match(/^\s*(?:\.\.\.)?\s*([A-Za-z_]\w*)\s*:/)
      if (m) keys.push(m[1])
      // Shorthand: `slug,` writes the column just as `slug: slug` does.
      const short = line.match(/^\s*([A-Za-z_]\w*)\s*$/)
      if (short) keys.push(short[1])
      line = ''
      continue
    }
    line += ch
  }
  const m = line.match(/^\s*([A-Za-z_]\w*)\s*:/)
  if (m) keys.push(m[1])
  return keys
}

// ── 1. The migration is still there and still says what this guard assumes ──
const migration = read(MIGRATION)
if (!migration) {
  bad(`${MIGRATION} is missing, so the grants this guard protects were never made`)
} else {
  const sql = migration.split(LF).map(l => l.replace(/^\s*--.*$/, '')).join(LF)
  for (const [table, re] of [
    ['organizations', /revoke[\s\S]{0,40}on public\.organizations from authenticated/],
    ['cards', /revoke[\s\S]{0,40}on public\.cards from authenticated/],
  ]) {
    if (!re.test(sql)) {
      bad(`${MIGRATION} no longer revokes the table-level grant on ${table}. A column list means nothing while the table grant stands - Postgres ignores a column revoke against it.`)
    }
  }
  // The deny list is the whole migration. Losing a name silently re-opens it.
  //
  // SCOPED TO THE ARRAY, not the file. Testing the whole migration was
  // vacuous: the proof query at the bottom lists all eighteen names in quotes
  // too, so deleting 'addons' from the deny list still matched down there and
  // the mutation walked through green.
  const from = sql.indexOf('denied text[] := array[')
  const to = from < 0 ? -1 : sql.indexOf('];', from)
  const denyList = from < 0 || to < 0 ? '' : sql.slice(from, to)
  if (!denyList) {
    bad(`${MIGRATION}: the \`denied\` array is gone, so the UPDATE grant is no longer built by exclusion and every column may be writable`)
  } else {
    for (const col of DENIED_UPDATE) {
      if (!new RegExp(`'${col}'`).test(denyList)) {
        bad(`${MIGRATION} no longer denies cards.${col} on UPDATE`)
      }
    }
  }
}

// ── 2. No client file writes organizations at all ───────────────────────────
const files = walk('app').concat(walk('components')).concat(walk('lib'))
const clientFiles = files.filter(f => /^\s*['"]use client['"]/m.test(read(f) || ''))

for (const f of clientFiles) {
  const src = code(read(f) || '')
  const m = src.match(/from\(['"]organizations['"]\)\s*[\s\S]{0,80}?\.(insert|update|upsert|delete)\s*\(/)
  if (m) {
    bad(`${f} writes organizations from the browser (.${m[1]}). The authenticated role holds no write on that table: every column is billing or control, so this has to go through a server route with the service role.`)
  }
}

// ── 3. Client writes to cards touch no denied column ────────────────────────
for (const f of clientFiles) {
  const src = code(read(f) || '')
  const re = /from\(['"]cards['"]\)\s*(?:\r?\n\s*)?\.(insert|update|upsert)\s*\(/g
  let m
  while ((m = re.exec(src))) {
    const verb = m[1]
    const rest = src.slice(m.index + m[0].length)
    // A payload held in a variable is checked at its own definition below, so
    // an unparseable call site is not silently treated as clean.
    if (!/^\s*\{/.test(rest)) {
      if (!/^\s*(payload|patch|fields|values)\b/.test(rest)) {
        bad(`${f}: cards.${verb}() is called with something this guard cannot read, so nobody can tell which columns it writes`)
      }
      continue
    }
    const keys = topLevelKeys(balanced(src, m.index + m[0].length))
    const allowed = verb === 'insert' ? ALLOWED_INSERT : null
    for (const k of keys) {
      if (allowed) {
        if (!allowed.includes(k) && k !== 'updated_at') {
          bad(`${f}: the browser inserts cards.${k}, which migration 084 did not grant. The insert grant is exactly what signup writes; adding a column here needs adding there too, or this fails in production only.`)
        }
      } else if (DENIED_UPDATE.includes(k)) {
        bad(`${f}: the browser updates cards.${k}, which migration 084 revoked. That column is service role only - see /api/slug, /api/card/addons, /api/account/primary-card, /api/cards/restore.`)
      }
    }
  }
}

// ── 4. And the card editor's payload is still built from content fields ─────
//
// CardEditor spreads a whole state object into its update, so the call site
// above shows nothing. The fields it may write are decided where `form` is
// built, and that is what has to stay clean.
const EDITOR = 'components/card/CardEditor.tsx'
const editor = code(read(EDITOR) || '')
if (!editor) {
  bad(`${EDITOR} is missing`)
} else {
  if (!/const payload[\s\S]{0,120}?\.\.\.form/.test(editor)) {
    bad(`${EDITOR}: the update payload is no longer spread from \`form\`, so what it writes is decided somewhere this guard cannot see`)
  }
  const at = editor.indexOf('const [form, setForm] = useState(')
  if (at < 0) {
    bad(`${EDITOR}: \`form\` is no longer a useState initialiser, so the column list it carries cannot be read`)
  } else {
    for (const k of topLevelKeys(balanced(editor, at))) {
      if (DENIED_UPDATE.includes(k)) {
        bad(`${EDITOR}: \`form\` carries ${k}, and the whole of \`form\` is spread into the cards update. Migration 084 revoked that column, so saving a card would fail with "permission denied for column ${k}".`)
      }
    }
  }
}

if (fail) {
  console.error(`${LF}check-card-column-grants: ${fail} failure(s).`)
  process.exit(1)
}
console.log(
  'check-card-column-grants: the browser writes cards content and nothing else, and never writes organizations - so the ' +
  'column grants migration 084 made can hold without the card editor or signup breaking against them.',
)
