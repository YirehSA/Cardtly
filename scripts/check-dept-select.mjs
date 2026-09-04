// Does getManagedDepartments actually ask for the columns ManagedDept promises?
//
// Migration 063 added inherit_brand and inherit_brand_locked. They were added
// to the ManagedDept type and read by the departments page, but not to the
// named column list in getManagedDepartments - and a named select does not
// return a column it did not ask for. So the page read undefined, treated it
// as "inheriting", and the brand toggle rendered on and snapped back to on
// after every refresh while the write underneath it had succeeded.
//
// Nothing failed. No error, no warning, no type error: the field is optional
// on the type, undefined is a legal value for it, and the UI has a sensible
// default for undefined. That is the whole problem, and it will recur on the
// next migration unless something checks.
//
// The select cascade below the first rung is deliberately allowed to be
// narrower: each rung exists to survive a database where a later migration has
// not been applied by hand yet. Only the richest one has to be complete.
//
// Run: node scripts/check-dept-select.mjs

import { readFileSync } from 'node:fs'

const SRC = 'lib/department-perms.ts'
const src = readFileSync(SRC, 'utf8')

const iface = src.match(/export interface ManagedDept \{([\s\S]*?)\n\}/)
if (!iface) {
  console.error('check-dept-select: ManagedDept not found in ' + SRC)
  process.exit(1)
}

// Every snake_case field is a real column. viaOwner and friends are camelCase
// and derived in code, so they are not expected in any select.
const fields = [...iface[1].matchAll(/^\s*([a-z][a-z0-9_]*)\??\s*:/gm)]
  .map(m => m[1])
  .filter(f => f.includes('_') || f === 'id' || f === 'name' || f === 'brand' || f === 'kind')

// The richest rung: the longest column list selected from departments here.
const selects = [...src.matchAll(/\.select\('([^']*)'\)/g)]
  .map(m => m[1])
  .filter(s => s.includes('organization_id') && s.includes('brand'))
if (selects.length === 0) {
  console.error('check-dept-select: found no department column list in ' + SRC)
  process.exit(1)
}
const richest = selects.sort((a, b) => b.length - a.length)[0]
const asked = new Set(richest.split(',').map(s => s.trim()))

const missing = fields.filter(f => !asked.has(f))
if (missing.length) {
  console.error('check-dept-select: ManagedDept declares columns the query never asks for:')
  for (const f of missing) console.error(`    ${f}`)
  console.error('\nA named select returns only the columns it names, so these read as')
  console.error('undefined forever. Add them to the richest .select() in ' + SRC + ',')
  console.error('keeping the narrower fallback rungs as they are.')
  process.exit(1)
}

console.log(
  `check-dept-select: ManagedDept declares ${fields.length} columns and the query asks for all of them ` +
  `(${selects.length} fallback rungs for hand-applied migrations).`
)
