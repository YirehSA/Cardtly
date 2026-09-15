// Every table in the public schema has to say something about RLS.
//
// WHAT THIS EXISTS BECAUSE OF. Migration 078 asked the right question, in
// writing: "077 closed whop_subscriptions and the obvious next question was
// whether anything else was in the same state. It was." It then found
// nfc_orders and stopped, because the sweep was a person reading migrations.
// Three tables were in exactly the same state and stayed open for another day,
// until the Supabase advisor flagged the least sensitive of the four and the
// sweep was run again, mechanically, and found the rest.
//
// The failure mode is not carelessness. It is that "check whether any other
// table has this problem" is a question you answer once, correctly, and then
// the answer silently rots the next time somebody adds a table. A table
// created without RLS looks exactly like a table created with it until
// somebody queries production with the public key.
//
// SO THE RULE IS: a create table in the migrations must be matched, somewhere
// in the migrations, by an enable row level security for that table. Not a
// policy, not a comment, not an intention. If a table is genuinely meant to be
// world readable it goes in EXPECTED_PUBLIC below with a reason, which makes
// it a decision somebody wrote down rather than one nobody made.
//
// DELIBERATELY STATIC. This reads SQL files, not the database. It cannot see a
// table created by hand in the dashboard, and it cannot see RLS switched off
// after the fact. It catches the one thing that actually happened four times:
// a table added by a migration that nobody thought about RLS for. The database
// itself is checked by the Supabase advisor, which is the other half of this
// and the reason the four were found at all.
//
// Run: node scripts/check-table-rls.mjs

import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'

const DIR = 'supabase/migrations'
const LF = String.fromCharCode(10)

// Tables that are meant to be readable with the anon key. Each entry needs a
// reason, because "it is fine" is what was assumed about the other four.
const EXPECTED_PUBLIC = {
  // 'example_table': 'why the whole world may read this',
}

let fail = 0
const bad = (msg) => { console.error(`  FAIL ${msg}`); fail++ }

let files = []
try {
  files = readdirSync(DIR).filter(f => f.endsWith('.sql')).sort()
} catch {
  bad(`${DIR} is missing, so this guard checks nothing`)
}
if (files.length === 0) bad(`no migrations found in ${DIR}`)

const created = new Map()   // table -> migration filename that creates it
const secured = new Set()   // table -> some migration enables RLS on it
const dropped = new Set()

for (const f of files) {
  // Comments stripped first, so the prose in these migrations - which quotes
  // create table and names tables it is describing rather than creating -
  // cannot register as the real thing. 078 and 082 are both full of it.
  const raw = readFileSync(join(DIR, f), 'utf8').replace(new RegExp(String.fromCharCode(13), 'g'), '')
  const sql = raw
    .split(LF).map(l => l.replace(/--.*$/, '')).join(LF)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .toLowerCase()

  for (const m of sql.matchAll(/create table\s+(?:if not exists\s+)?(?:public\.)?([a-z_0-9]+)/g)) {
    if (!created.has(m[1])) created.set(m[1], f)
  }
  for (const m of sql.matchAll(/alter table\s+(?:if exists\s+)?(?:public\.)?([a-z_0-9]+)\s+enable row level security/g)) {
    secured.add(m[1])
  }
  for (const m of sql.matchAll(/drop table\s+(?:if exists\s+)?(?:public\.)?([a-z_0-9]+)/g)) {
    dropped.add(m[1])
  }
}

const open = []
for (const [table, where] of [...created].sort()) {
  if (dropped.has(table)) continue
  if (secured.has(table)) continue
  if (table in EXPECTED_PUBLIC) continue
  open.push({ table, where })
}

for (const o of open) {
  bad(
    `public.${o.table} is created in ${o.where} and no migration ever enables row level security on it. ` +
    `Tables in the public schema are exposed through PostgREST, so anyone holding the anon key - which ships in the ` +
    `site's JavaScript - can query it. Add "alter table public.${o.table} enable row level security;" in a migration, ` +
    `or add it to EXPECTED_PUBLIC in this script with a reason.`,
  )
}

// A guard that can only ever pass is not a guard. If the parser stops seeing
// create table at all, everything "passes" and nothing is checked.
if (created.size === 0) {
  bad('no create table statements were found in any migration, so this guard cannot see what it is checking')
}
if (secured.size === 0 && created.size > 0) {
  bad('no migration appears to enable row level security on anything, which means the parser is broken rather than the schema being uniquely bad')
}

if (fail) {
  console.error(`${LF}check-table-rls: ${fail} failure(s).`)
  process.exit(1)
}

// Counted as "created by a migration and not dropped", which is the set this
// guard can actually speak for. secured can legitimately be larger: a few
// tables predate the migrations directory and are only ever altered by it.
const live = [...created.keys()].filter(t => !dropped.has(t)).length
const exempt = Object.keys(EXPECTED_PUBLIC).length
console.log(
  `check-table-rls: ${live} live table(s) created across ${files.length} migrations, ` +
  `every one covered by an enable row level security` +
  (exempt ? `, ${exempt} deliberately public` : '') +
  `. Nothing left open to the anon key by accident.`,
)
