// Can a rep see somebody else's quote?
//
// Reps were given access to quotes and to nothing else. The rule that makes
// that true is not the page they land on, it is that every quotes query is
// narrowed to created_by before it reaches the database. A UI filter is a
// suggestion; a query filter is a rule.
//
// This reads the route source rather than running it, because the failure mode
// is a query somebody forgets to scope - which is a thing you can see in the
// text and cannot see by testing the happy path as an admin.
//
// Run: node scripts/check-quote-access.mjs

import { readFileSync, existsSync } from 'node:fs'

let fail = 0
const bad = (msg) => { console.error(`  FAIL ${msg}`); fail++ }

const QUOTES = 'app/api/admin/billing/quotes/route.ts'
const PDF = 'app/api/admin/billing/quotes/pdf/route.ts'

// ── Quotes are not emailed from the system ────────────────────────────────
// Cardtly sends quotes out with a proposal by hand. A send route reappearing
// here means somebody rebuilt a thing that was removed on purpose.
if (existsSync('app/api/admin/billing/quotes/send')) {
  bad('a quote send route exists again. Quotes go out with the proposal, not from the system.')
}
{
  const tab = readFileSync('components/admin/billing/QuotesTab.tsx', 'utf8')
  if (/quotes\/send/.test(tab)) bad('the quotes screen still calls a send endpoint')
  if (/Email this quote/.test(tab)) bad('the quotes screen still offers to email a quote')
  // The accept link is how a quote reaches a client, so it must survive.
  if (!/copyLink/.test(tab)) bad('the quotes screen lost the copy-accept-link button')
}

// ── Every quotes read is scoped ───────────────────────────────────────────
{
  const src = readFileSync(QUOTES, 'utf8')

  if (/requireAdmin/.test(src)) bad('the quotes route still uses requireAdmin, so reps cannot reach it')
  if (!/requireQuoteAccess/.test(src)) bad('the quotes route is not behind requireQuoteAccess')

  // Any select on quotes must go through mine(), which applies created_by.
  const selects = [...src.matchAll(/(.{0,60})from\('quotes'\)\s*\.select\(/g)]
  if (!selects.length) bad('found no quotes selects to check, so this guard is checking nothing')
  for (const m of selects) {
    if (!/mine\(/.test(m[1])) {
      bad(`an unscoped read of quotes: ...${m[1].trim().slice(-50)}from('quotes').select(`)
    }
  }

  if (!/function mine\(/.test(src)) bad('mine() is gone, so nothing narrows a rep to their own quotes')
  if (!/actor\.isAdmin \? q : q\.eq\('created_by'/.test(src)) {
    bad('mine() no longer narrows by created_by')
  }

  // Converting a quote to an invoice is billing, not selling.
  if (!/isAdmin[\s\S]{0,200}Only Cardtly staff can turn a quote into an invoice/.test(src)) {
    bad('a rep can convert a quote into an invoice')
  }
}

// ── The PDF is scoped too ─────────────────────────────────────────────────
{
  const src = readFileSync(PDF, 'utf8')
  if (!/requireQuoteAccess/.test(src)) bad('the quote PDF route is not behind requireQuoteAccess')
  if (!/created_by/.test(src)) {
    bad('the quote PDF is not scoped by created_by, so a rep with an id could read anyone\'s pricing')
  }
}

// ── A rep sees names, not balances ────────────────────────────────────────
{
  const src = readFileSync('app/api/admin/billing/clients/route.ts', 'utf8')
  if (!/requireQuoteAccess/.test(src)) bad('reps cannot read the client list, so they cannot address a quote')
  if (!/!actor\.isAdmin[\s\S]{0,200}select\('id, name'\)/.test(src)) {
    bad('the rep client list is not narrowed to id and name')
  }
  // Editing and deleting a client stays with staff. Sliced rather than matched
  // with a built regex: escaping a character class through a template literal
  // is exactly the kind of thing that silently matches nothing and reports a
  // problem that is not there.
  for (const method of ['PATCH', 'DELETE']) {
    const at = src.indexOf(`export async function ${method}(`)
    if (at === -1) { bad(`clients ${method} has gone`); continue }
    const head = src.slice(at, at + 200)
    if (!head.includes('requireAdmin')) bad(`clients ${method} is not admin only`)
  }
}

// ── Nothing else in billing opened up ─────────────────────────────────────
// The one thing that would undo all of the above is a rep gate spreading to a
// route that shows the books.
{
  const ALLOWED = [
    'app/api/admin/billing/quotes/route.ts',
    'app/api/admin/billing/quotes/pdf/route.ts',
    'app/api/admin/billing/clients/route.ts',
  ]
  const { execSync } = await import('node:child_process')
  const hits = execSync('git ls-files app/api/admin', { encoding: 'utf8' })
    .split('\n').filter(Boolean)
    .filter(f => existsSync(f) && /requireQuoteAccess/.test(readFileSync(f, 'utf8')))
  for (const f of hits) {
    const norm = f.split(String.fromCharCode(92)).join('/')
    if (!ALLOWED.includes(norm)) {
      bad(`${f} lets reps in. Reps may reach quotes and the client name list, nothing else.`)
    }
  }
}

if (fail) {
  console.error(`\ncheck-quote-access: ${fail} failure(s).`)
  process.exit(1)
}
console.log(
  'check-quote-access: quotes are not emailed from the system, every quotes read is narrowed to ' +
  'created_by, reps see client names but no balances, and no other admin route lets a rep in.',
)
