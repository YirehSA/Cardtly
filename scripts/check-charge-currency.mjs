// Visitors outside the rand zone are never left thinking the dollar figure is
// the charge.
//
// WHY. Paystack cannot charge a South African business's customers in dollars
// (USD is offered to Kenyan and Nigerian businesses only), so every Cardtly
// charge is in rand and a foreign card's bank converts it at its own rate,
// sometimes with a fee. The site shows "≈ $6" to visitors outside South
// Africa, Namibia, Lesotho and Eswatini as a courtesy. On its own that reads
// as the price. And Visa's rules want the transaction currency, amount,
// frequency and cancellation terms agreed before a card is stored for
// recurring charges, with the merchant's country shown in the checkout.
//
// WHAT THIS HOLDS:
//   1. Any file that shows a dollar estimate also shows RandChargeNote.
//   2. Both checkouts (Pro and Teams) state the recurring terms and the
//      company's country beside the pay button.
//   3. The FX endpoint keeps the whole rand zone on rand, stays off without a
//      country, and has a sane fallback rate.
//   4. The terms say every charge is in rand and other currencies are
//      estimates, and nothing sends Paystack a currency other than rand.
//
// Run: node scripts/check-charge-currency.mjs

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

let fail = 0
const bad = (msg) => { console.error(`  FAIL ${msg}`); fail++ }
const read = (p) => { try { return readFileSync(p, 'utf8').replace(/\r/g, '') } catch { return null } }

function walk(dir, acc = []) {
  let entries
  try { entries = readdirSync(dir) } catch { return acc }
  for (const e of entries) {
    if (e === 'node_modules' || e === '.next' || e.startsWith('.')) continue
    const p = join(dir, e)
    if (statSync(p).isDirectory()) walk(p, acc)
    else if (/\.(ts|tsx)$/.test(p)) acc.push(p.split('\\').join('/'))
  }
  return acc
}
const files = walk('app').concat(walk('components')).concat(walk('lib'))

// ── 1. No estimate without the note ─────────────────────────────────────────
const est = read('components/marketing/UsdEstimate.tsx') || ''
// Sliced to the end of the file (it is the last declaration), not to the first
// "\n}": the props are a multi-line object type whose closing brace sits in
// column zero, and a brace-based slice would stop at the end of the signature.
const noteAt = est.indexOf('export function RandChargeNote')
const note = noteAt < 0 ? '' : est.slice(noteAt)
if (!note) bad('components/marketing/UsdEstimate.tsx no longer exports RandChargeNote.')
else {
  // The rendered string, quote included, so the prop's doc comment (which
  // quotes the same words) cannot stand in for it.
  if (!/'Charged in South African rand \(ZAR\)\./.test(note)) bad('RandChargeNote no longer names the charge currency as South African rand (ZAR).')
  if (!/fx\.showUsd/.test(note)) bad('RandChargeNote no longer shows for the same visitors as the estimate (fx.showUsd).')
}
const showing = files
  .filter(f => f !== 'components/marketing/UsdEstimate.tsx') // defines it, and names it in a comment
  .filter(f => /<UsdEstimate\b/.test(read(f) || ''))
if (showing.length < 4) bad(`found only ${showing.length} files showing a dollar estimate; expected the pricing, signup, upgrade and team pages at least.`)
for (const f of showing) {
  if (!/<RandChargeNote\b/.test(read(f) || '')) {
    bad(`${f} shows a dollar estimate without RandChargeNote. A foreign visitor reads "≈ $6" as the price, and the statement then says something else.`)
  }
}

// ── 2. The checkouts state the recurring terms ──────────────────────────────
for (const f of ['components/upgrade/UpgradeView.tsx', 'components/team/TeamDashboard.tsx']) {
  const src = read(f) || ''
  if (!src) { bad(`${f} is missing.`); continue }
  const want = [
    [/now<\/strong>, then /, 'the amount charged now and on each renewal'],
    // Whitespace-tolerant: JSX wraps these sentences wherever the line fills.
    [/until\s+you\s+cancel,\s+charged\s+in\s+South\s+African\s+rand\s+\(ZAR\)/, 'the frequency and the transaction currency'],
    [/stays?\s+live\s+until\s+the\s+end\s+of\s+the\s+period\s+you\s+have\s+paid\s+for/, 'what cancelling does'],
    [/Sold\s+by\s+Cardtly\s+\(Pty\)\s+Ltd,\s+a\s+South\s+African\s+company/, "the merchant's country"],
    [/<RandChargeNote\b/, 'the bank-conversion note for foreign cards'],
  ]
  for (const [re, what] of want) {
    if (!re.test(src)) bad(`${f} no longer states ${what} beside the pay button.`)
  }
}

// ── 3. The FX endpoint ──────────────────────────────────────────────────────
const fx = read('app/api/pricing/fx/route.ts') || ''
const zone = fx.match(/RAND_COUNTRIES = new Set\(\[([^\]]*)\]\)/)?.[1] || ''
for (const c of ['ZA', 'NA', 'LS', 'SZ']) {
  if (!zone.includes(`'${c}'`)) bad(`the FX endpoint no longer treats ${c} as rand. Rand-zone visitors would be shown dollars for a price they already read in their own currency.`)
}
if (!/country\.length === 2 && !RAND_COUNTRIES\.has\(country\)/.test(fx)) {
  bad('the FX endpoint no longer defaults to rand when the country is unknown.')
}
const fallback = Number(fx.match(/FALLBACK_ZAR_TO_USD = ([0-9.]+)/)?.[1])
if (!(fallback > 0.03 && fallback < 0.12)) bad(`the fallback ZAR to USD rate (${fallback}) is not a plausible rate.`)

// ── 4. Terms, and what Paystack is asked for ────────────────────────────────
const terms = read('app/terms/page.tsx') || ''
if (!/Every charge is made in South African rand \(ZAR\)/.test(terms) || !/estimate for convenience only/.test(terms)) {
  bad('the terms no longer say every charge is in rand and that other currencies are estimates.')
}
for (const f of files.filter(f => /api\.paystack\.co/.test(read(f) || ''))) {
  const m = (read(f) || '').match(/currency:\s*['"`](\w+)['"`]/g) || []
  for (const hit of m) {
    if (!/ZAR/.test(hit)) bad(`${f} sends Paystack ${hit}. A South African Paystack account can only charge in rand; anything else fails at checkout.`)
  }
}

if (fail) {
  console.error(`\ncheck-charge-currency: ${fail} failure(s).`)
  process.exit(1)
}
console.log(
  `check-charge-currency: ${showing.length} files show a dollar estimate and every one says the charge is in rand, both checkouts state ` +
  'amount, currency, frequency, cancellation and the company\'s country, the rand zone stays on rand, and the terms agree.',
)
