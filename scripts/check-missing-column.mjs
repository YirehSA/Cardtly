// "That column is not there yet" is asked in one place, and knows both answers.
//
// WHAT THIS EXISTS BECAUSE OF. This codebase deploys code before its migration
// on purpose, so routes guard new columns and degrade rather than 500. Those
// guards were written against Postgres's 42703 undefined_column, and for a
// WRITE that code never arrives: PostgREST validates the payload against its
// own schema cache and refuses it before any SQL is sent, so the code is
// PGRST204 and Postgres never sees the statement.
//
// Verified against the live database by writing a column that does not exist:
//
//   select  ->  42703     column cards.no_such_column does not exist
//   insert  ->  PGRST204  Could not find the 'no_such_column' column of 'cards'
//   update  ->  PGRST204  Could not find the 'no_such_column' column of 'cards'
//
// So a guard on a write that tests 42703 alone does nothing at all.
// /api/analytics was written that way and would have returned 500 on every
// card view until migration 086 ran. /api/account/primary-card was written
// that way and its "not switched on yet" message could never fire.
//
// Behavioural, like check-visitor-hash: it runs the real predicate against the
// real error shapes, because reading the source cannot tell you whether a
// condition is reachable.
//
// Run: node scripts/check-missing-column.mjs

import { spawnSync } from 'child_process'
import { fileURLToPath } from 'url'
import { readFileSync } from 'fs'

if (!process.execArgv.includes('--experimental-strip-types')) {
  const r = spawnSync(
    process.execPath,
    ['--experimental-strip-types', '--no-warnings', fileURLToPath(import.meta.url)],
    { stdio: 'inherit' },
  )
  process.exit(r.status ?? 1)
}

const LF = String.fromCharCode(10)
let fail = 0
const bad = (msg) => { console.error(`  FAIL ${msg}`); fail++ }
const ok = (cond, msg) => { if (!cond) bad(msg) }

const { isMissingColumn, isMissingTable } = await import('../lib/pg-errors.ts')

// The three real shapes, copied from the live database.
const SELECT_ERR = { code: '42703', message: 'column cards.no_such_column_xyz does not exist' }
const WRITE_ERR = { code: 'PGRST204', message: "Could not find the 'visitor_hash' column of 'card_events' in the schema cache" }
const TABLE_ERR = { code: '42P01', message: 'relation "public.nope" does not exist' }

ok(isMissingColumn(WRITE_ERR), 'a PostgREST PGRST204 is not recognised as a missing column, so every insert and update guard in the app is dead code')
ok(isMissingColumn(SELECT_ERR), 'a Postgres 42703 is not recognised as a missing column, so the select guards stop working')

// EACH ROUTE ON ITS OWN. Testing only the two real errors above could not tell
// the code test from the message test, because the real PGRST204 message also
// matches the message pattern - deleting the code check entirely still passed.
// A client that returns a code without a message, or a message without a code,
// has to be recognised by whichever half survives.
ok(isMissingColumn({ code: 'PGRST204' }), 'PGRST204 is only recognised via its message text, so a client that reports the code without one is unguarded')
ok(isMissingColumn({ code: '42703' }), '42703 is only recognised via its message text, so a client that reports the code without one is unguarded')
ok(isMissingColumn({ message: "Could not find the 'x' column of 'y' in the schema cache" }), 'the PostgREST wording is not recognised without a code')
ok(isMissingColumn({ message: 'column cards.x does not exist' }), 'the Postgres wording is not recognised without a code')

// And it must NOT swallow real faults, or a genuine bug degrades silently.
ok(!isMissingColumn({ code: '23505', message: 'duplicate key value violates unique constraint' }), 'a unique violation reads as a missing column, so a real constraint failure would be silently degraded')
ok(!isMissingColumn({ code: '42501', message: 'permission denied for table card_events' }), 'a permission error reads as a missing column - which is exactly the error migration 085 produced, and treating it as "not migrated yet" would have hidden a broken analytics route')
ok(!isMissingColumn(TABLE_ERR), 'a missing TABLE reads as a missing column; they are different questions and several callers ask both')
ok(!isMissingColumn(null) && !isMissingColumn(undefined) && !isMissingColumn('nope'), 'a null or non-object error is not handled and would throw inside an error path')

ok(isMissingTable(TABLE_ERR), 'a 42P01 is not recognised as a missing table')
ok(!isMissingTable(WRITE_ERR), 'a missing column reads as a missing table')

// NO WRITE ANYWHERE MAY BE GUARDED BY 42703 ALONE. Named files would go stale
// the moment somebody adds a route, and a route added later is exactly the one
// that would copy the old pattern from its neighbours. Twelve sites had this
// and every one was found by reading the operation rather than the file name,
// so the rule is checked the same way.
const { readdirSync, statSync } = await import('fs')
const { join } = await import('path')

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

const WRITES = ['insert', 'update', 'upsert', 'delete']
for (const file of ['app', 'components', 'lib'].flatMap(d => walk(d))) {
  const raw = readFileSync(file, 'utf8')
  if (/PGRST204/.test(raw)) continue          // knows about both already
  const lines = raw.split(/\r?\n/)
  lines.forEach((line, i) => {
    if (!/42703/.test(line)) return
    if (/^\s*(\/\/|\*|\/\*)/.test(line)) return   // prose, not a test
    // The nearest preceding supabase call decides whether this guards a read
    // or a write. A read may legitimately test 42703; a write cannot receive it.
    let op = null
    for (let j = i; j >= 0 && j > i - 40; j--) {
      const m = lines[j].match(/\.(insert|update|upsert|delete|select)\s*\(/)
      if (m) { op = m[1]; break }
    }
    if (op && WRITES.includes(op)) {
      bad(
        `${file}:${i + 1} guards a .${op}() with 42703 alone. A write never receives that code - PostgREST ` +
        `refuses the payload against its schema cache and returns PGRST204 - so the branch can never run. ` +
        `Use isMissingColumn from lib/pg-errors.`,
      )
    }
  })
}

if (fail) {
  console.error(`${LF}check-missing-column: ${fail} failure(s).`)
  process.exit(1)
}
console.log(
  'check-missing-column: one predicate answers "is that column missing", knows that a write reports PGRST204 and a ' +
  'read reports 42703, and refuses to mistake a permission error or a unique violation for an unrun migration.',
)
