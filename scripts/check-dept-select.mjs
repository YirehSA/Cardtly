// Every read of the departments table must use select('*').
//
// The table's columns arrive across migrations that are applied BY HAND, in
// whatever order somebody gets to them. When this was written, 063 had been
// applied and 059 had not, so a query naming brand_source failed on a database
// that already had inherit_brand.
//
// getManagedDepartments tried to survive that with a ladder of named column
// lists, one rung per migration, each dropping what the rung above needed. It
// could not work: a rung naming brand_source failed, the query fell through to
// a rung that also omitted inherit_brand, and the departments page read
// inherit_brand as undefined. The group-look toggle rendered on and snapped
// back after every refresh while the write underneath it succeeded every time.
//
// A ladder would need one rung per SUBSET of applied migrations, which is two
// to the power of the migration count. select('*') returns whatever the
// database actually has, which is the only thing that was ever wanted.
//
// Run: node scripts/check-dept-select.mjs

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ROOTS = ['app', 'lib', 'components']
const files = []
const walk = dir => {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (entry === 'node_modules' || entry.startsWith('.')) continue
    if (statSync(full).isDirectory()) walk(full)
    else if (/\.(ts|tsx)$/.test(entry)) files.push(full)
  }
}
for (const r of ROOTS) { try { walk(r) } catch {} }

// A read of the table, and what it asked for. Writes (.update/.insert/.delete)
// and .select('id') after an insert are not reads of the brand columns, so
// only genuine column lists are considered.
const READ = /\.from\('departments'\)\s*(?:\r?\n\s*)*\.select\('([^']*)'\)/g

// Narrow reads that genuinely need one or two columns and never feed the brand
// cascade or ManagedDept. Each is listed with the columns it is allowed.
const ALLOWED_NARROW = new Set([
  'id', 'organization_id', 'id, slug_segment', 'organization_id, kind, name',
  'id, organization_id, name', 'kind, name', 'brand',
  'id, organization_id, name, brand',
])

const offenders = []
for (const f of files) {
  const src = readFileSync(f, 'utf8')
  for (const m of src.matchAll(READ)) {
    const cols = m[1].trim()
    if (cols === '*') continue
    if (ALLOWED_NARROW.has(cols)) continue
    const line = src.slice(0, m.index).split('\n').length
    offenders.push(`${f}:${line}  select('${cols.slice(0, 90)}${cols.length > 90 ? '...' : ''}')`)
  }
}

if (offenders.length) {
  console.error('check-dept-select: departments read with a named column list:')
  for (const o of offenders) console.error(`    ${o}`)
  console.error('\nThe columns arrive across hand-applied migrations, so a named list')
  console.error("silently returns undefined for anything not yet applied. Use select('*'),")
  console.error('or add the query to ALLOWED_NARROW here if it truly needs only those columns')
  console.error('and never feeds the brand cascade or ManagedDept.')
  process.exit(1)
}

const total = files.reduce((n, f) => n + [...readFileSync(f, 'utf8').matchAll(READ)].length, 0)
console.log(`check-dept-select: ${total} departments reads, none using an unapproved column list.`)
