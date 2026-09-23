// Every table a migration creates says, in the same file, who may reach it.
//
// WHY. From 30 October 2026 Supabase stops granting Data API access to new
// tables in public automatically. A table created afterwards is born with no
// grants at all - not to anon, not to authenticated, and not to service_role.
// Every Cardtly server route that writes through the admin client needs
// service_role, so a migration written the way 075 wrote rep_activities (RLS
// on, grants left to the default) would create a table that the server itself
// is refused. That fails at runtime, on the first request, after the migration
// has already been run in production by hand.
//
// AND THE OPPOSITE MISTAKE IS THE ONE SUPABASE'S OWN EMAIL INVITES. Its
// suggested fix grants insert, update and delete to authenticated on every new
// table. Migrations 083 to 085 exist because that was the old default and it
// let any signed-in user write to almost anything - including setting their own
// is_admin. Pasting the template would reopen exactly that, one table at a
// time, with every appearance of following instructions.
//
// So, for any table created by a migration numbered 089 or later:
//
//   1. row level security is enabled in the same file
//   2. service_role is granted explicitly - the server needs it and after
//      30 October it is no longer given by default
//   3. anon is never granted a write
//   4. authenticated is granted a write only if the table is listed in
//      BROWSER_WRITES below, with the reason the browser must write it rather
//      than a server route
//
// THE PATTERN THAT PASSES, for a table only the server touches:
//
//     create table if not exists public.things ( ... );
//     alter table public.things enable row level security;
//     grant select, insert, update, delete on public.things to service_role;
//
// and, if the browser reads it under RLS:
//
//     grant select on public.things to authenticated;
//
// Earlier migrations are history and are not re-checked; 085 already swept
// every table that existed when it ran.
//
// Run: node scripts/check-migration-grants.mjs

import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'

const DIR = 'supabase/migrations'
const FIRST_CHECKED = 89
const LF = String.fromCharCode(10)

// Tables the BROWSER must write directly, with the reason. Mirrors 085's
// browser_writes, which is cards and profiles and nothing else. A new table
// belongs here only if a server route genuinely cannot do the write.
const BROWSER_WRITES = {
  // 'example_table': 'why a server route cannot do this write',
}

let fail = 0
const bad = (msg) => { console.error(`  FAIL ${msg}`); fail++ }
const read = (p) => readFileSync(p, 'utf8').replace(/\r/g, '')

/** SQL with comments removed, so a comment explaining a rule cannot satisfy
 *  it and a commented-out grant cannot count. */
const code = (s) => s
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split(LF).map(l => l.replace(/--.*$/, '')).join(LF)

const norm = (name) => name.replace(/^public\./i, '').replace(/"/g, '').toLowerCase()

let files = []
try {
  files = readdirSync(DIR).filter(f => /^\d{3}_.*\.sql$/.test(f)).sort()
} catch {
  bad(`${DIR} cannot be read`)
}

let checkedTables = 0
for (const f of files) {
  const num = Number(f.slice(0, 3))
  if (num < FIRST_CHECKED) continue
  const sql = code(read(join(DIR, f)))

  // Every grant in the file, as { privs, target, roles }.
  const grants = [...sql.matchAll(/grant\s+([\s\S]*?)\s+on\s+(?:table\s+)?([\s\S]*?)\s+to\s+([\s\S]*?);/gi)]
    .map(m => ({
      privs: m[1].toLowerCase(),
      target: m[2].trim(),
      roles: m[3].toLowerCase().split(',').map(r => r.trim()),
    }))
  const isWrite = (privs) => /\b(insert|update|delete|all|truncate)\b/.test(privs)

  // A blanket grant over the whole schema undoes every table's decision at once.
  for (const g of grants) {
    if (/all\s+tables\s+in\s+schema/i.test(g.target) && isWrite(g.privs)) {
      for (const role of ['anon', 'authenticated']) {
        if (g.roles.includes(role)) {
          bad(`${f} grants writes on ALL TABLES in a schema to ${role}. That is the default migrations 083 to 085 were written to remove, restored in one line.`)
        }
      }
    }
  }

  for (const m of sql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?((?:public\.)?"?[a-z_][a-z0-9_]*"?)/gi)) {
    const raw = m[1]
    if (/^(?!public\.)[a-z_]+\./i.test(raw)) continue // another schema
    const table = norm(raw)
    checkedTables++
    const onThis = grants.filter(g => norm(g.target) === table)

    // 1. RLS
    const rls = new RegExp(`alter\\s+table\\s+(?:only\\s+)?(?:public\\.)?"?${table}"?\\s+enable\\s+row\\s+level\\s+security`, 'i')
    if (!rls.test(sql)) {
      bad(`${f} creates public.${table} without enabling row level security in the same migration. Without it, any grant to anon or authenticated reaches every row.`)
    }

    // 2. service_role, explicitly
    if (!onThis.some(g => g.roles.includes('service_role'))) {
      bad(`${f} creates public.${table} without granting it to service_role. From 30 October Supabase no longer does that by default, so every server route using the admin client would be refused on this table. Add: grant select, insert, update, delete on public.${table} to service_role;`)
    }

    // 3 and 4. writes by the browser roles
    for (const g of onThis) {
      if (!isWrite(g.privs)) continue
      if (g.roles.includes('anon')) {
        bad(`${f} grants "${g.privs}" on public.${table} to anon. Anonymous visitors never write directly - migration 085 revoked that everywhere. Do the write in a server route with the service role.`)
      }
      if (g.roles.includes('authenticated') && !BROWSER_WRITES[table]) {
        bad(`${f} grants "${g.privs}" on public.${table} to authenticated. That is Supabase's suggested template, and it is the default 083 to 085 removed: any signed-in user could then write any row RLS lets through. Route the write through a server route, or add ${table} to BROWSER_WRITES in this script with the reason the browser must write it.`)
      }
    }
  }
}

if (fail) {
  console.error(`${LF}check-migration-grants: ${fail} failure(s).`)
  process.exit(1)
}
console.log(
  `check-migration-grants: ${checkedTables} table(s) created since migration ${String(FIRST_CHECKED).padStart(3, '0')}, ` +
  'every one with row level security, an explicit service_role grant, and no browser writes that are not justified - ' +
  'so nothing new is unreachable after Supabase\'s 30 October change, and nothing reopens what 085 closed.',
)
