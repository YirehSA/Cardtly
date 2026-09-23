// Visitors outside the rand zone see an estimate in their own currency, and
// are never left thinking it is the charge.
//
// WHY. Paystack cannot charge a South African business's customers in anything
// but rand (USD is offered to Kenyan and Nigerian businesses only, and there is
// no EUR or GBP), so every Cardtly charge is in rand and a foreign card's bank
// converts it at its own rate, sometimes with a fee. The site shows "≈ £4.50"
// in the UK, "≈ €5" across Europe and "≈ $6" elsewhere as a courtesy. On its
// own that reads as the price. And Visa's rules want the transaction currency,
// amount, frequency and cancellation terms agreed before a card is stored for
// recurring charges, with the merchant's country shown in the checkout.
//
// WHAT THIS HOLDS:
//   1. The currency rules, actually run: the rand zone and unknown visitors
//      get no estimate, the UK pounds, Europe euros, everyone else dollars;
//      amounts round the way an estimate should; fallback rates are plausible.
//   2. Any file that shows an estimate also shows RandChargeNote.
//   3. Both checkouts (Pro and Teams) state the recurring terms and the
//      company's country beside the pay button.
//   4. The FX endpoint decides with those rules, and its test cookie is
//      development-only.
//   5. The terms say every charge is in rand and other currencies are
//      estimates, and nothing sends Paystack a currency other than rand.
//
// Run: node scripts/check-charge-currency.mjs

import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, renameSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

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

// ── 1. The currency rules, run ──────────────────────────────────────────────
//
// Compiled with the project's own tsc into a temp folder and imported, the same
// way check-billing-maths does it.
const out = mkdtempSync(join(tmpdir(), 'price-currency-'))
let C
try {
  execFileSync(
    process.execPath,
    ['node_modules/typescript/bin/tsc', 'lib/price-currency.ts', '--outDir', out,
     '--module', 'es2020', '--target', 'es2020', '--moduleResolution', 'node'],
    { stdio: 'pipe' },
  )
  renameSync(join(out, 'price-currency.js'), join(out, 'price-currency.mjs'))
  C = await import(pathToFileURL(join(out, 'price-currency.mjs')).href)
} catch (e) {
  console.error('check-charge-currency: could not compile lib/price-currency.ts')
  console.error(String(e.stdout || e.message).slice(0, 600))
  process.exit(1)
} finally {
  try { rmSync(out, { recursive: true, force: true }) } catch {}
}

const expect = {
  // The rand zone already reads R97 in its own money; unknown gets nothing.
  ZA: null, NA: null, LS: null, SZ: null, '': null, XX1: null, za: null,
  // The UK and the places on its pound.
  GB: 'GBP', gb: 'GBP', JE: 'GBP', GG: 'GBP', IM: 'GBP', GI: 'GBP',
  // The eurozone, including Bulgaria since 2026, and euro users outside it.
  DE: 'EUR', FR: 'EUR', IE: 'EUR', NL: 'EUR', ES: 'EUR', IT: 'EUR', BG: 'EUR', HR: 'EUR', MC: 'EUR', ME: 'EUR',
  // The rest of Europe reads euros too.
  SE: 'EUR', PL: 'EUR', CH: 'EUR', NO: 'EUR', DK: 'EUR',
  // Everyone else, dollars.
  US: 'USD', CA: 'USD', AU: 'USD', AE: 'USD', KE: 'USD', NG: 'USD', BW: 'USD', ZW: 'USD', IN: 'USD',
}
let ruleCases = 0
for (const [country, want] of Object.entries(expect)) {
  ruleCases++
  const got = C.estimateCurrencyFor(country)
  if (got !== want) bad(`estimateCurrencyFor('${country}') is ${got}, expected ${want}.`)
}
const fmt = [
  [4.3668, 'GBP', '£4.50'], [5.2274, 'EUR', '€5'], [5.9841, 'USD', '$6'],
  [44.84, 'GBP', '£45'], [52.28, 'EUR', '€52'], [9.8, 'USD', '$10'], [3.24, 'EUR', '€3'],
]
for (const [amount, cur, want] of fmt) {
  ruleCases++
  const got = C.formatEstimate(amount, cur)
  if (got !== want) bad(`formatEstimate(${amount}, ${cur}) is ${got}, expected ${want}.`)
}
for (const cur of ['USD', 'EUR', 'GBP']) {
  const f = C.FALLBACK_RATE?.[cur]
  const [lo, hi] = C.SANE_RATE?.[cur] || [0, 0]
  if (!(f > lo && f < hi)) bad(`the fallback ${cur} rate (${f}) is outside its own plausible range (${lo} to ${hi}).`)
}
// The fallbacks must also be in the right ORDER: a pound buys more rand than a
// euro, and a euro more than a dollar. Swapped constants show a price 30% off.
if (!(C.FALLBACK_RATE.GBP < C.FALLBACK_RATE.EUR && C.FALLBACK_RATE.EUR < C.FALLBACK_RATE.USD)) {
  bad('the fallback rates are not ordered pound < euro < dollar (units per rand). Two of them have been swapped.')
}

// ── 2. No estimate without the note ─────────────────────────────────────────
const EST = 'components/marketing/PriceEstimate.tsx'
const est = read(EST) || ''
// Sliced to the end of the file (it is the last declaration), not to the first
// "\n}": the props are a multi-line object type whose closing brace sits in
// column zero, and a brace-based slice would stop at the end of the signature.
const noteAt = est.indexOf('export function RandChargeNote')
const note = noteAt < 0 ? '' : est.slice(noteAt)
if (!note) bad(`${EST} no longer exports RandChargeNote.`)
else {
  // The rendered string, quote included, so the prop's doc comment (which
  // quotes the same words) cannot stand in for it.
  if (!/'Charged in South African rand \(ZAR\)\./.test(note)) bad('RandChargeNote no longer names the charge currency as South African rand (ZAR).')
  if (!/!fx\.currency\) return null/.test(note)) bad('RandChargeNote no longer shows for exactly the visitors who see an estimate (fx.currency).')
}
if (!/formatEstimate\(/.test(est)) bad(`${EST} no longer formats with formatEstimate, so the tested rounding and symbols are not what visitors see.`)

const showing = files
  .filter(f => f !== EST) // defines it
  .filter(f => /<PriceEstimate\b/.test(read(f) || ''))
if (showing.length < 4) bad(`found only ${showing.length} files showing a price estimate; expected the pricing, signup, upgrade and team pages at least.`)
for (const f of showing) {
  if (!/<RandChargeNote\b/.test(read(f) || '')) {
    bad(`${f} shows a price estimate without RandChargeNote. A foreign visitor reads "≈ £4.50" as the price, and the statement then says something else.`)
  }
}
const stale = files.filter(f => /\bUsdEstimate\b/.test(read(f) || ''))
if (stale.length) bad(`${stale.join(', ')} still refer to UsdEstimate, which no longer exists.`)

// ── 3. The checkouts state the recurring terms ──────────────────────────────
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

// ── 4. The FX endpoint ──────────────────────────────────────────────────────
const fx = read('app/api/pricing/fx/route.ts') || ''
if (!/estimateCurrencyFor\(country\)/.test(fx)) {
  bad('the FX endpoint no longer decides the currency with estimateCurrencyFor, so the rules tested above are not the ones visitors get.')
}
if (/RAND_COUNTRIES = new Set/.test(fx)) {
  bad('the FX endpoint has its own RAND_COUNTRIES again. There must be one list, in lib/price-currency, or the two drift.')
}
if (!/process\.env\.NODE_ENV !== 'production'\s*\?\s*\(await cookies\(\)\)\.get\('fx_country'\)/.test(fx)) {
  bad("the FX endpoint's fx_country test cookie is no longer limited to development. In production anyone could choose their own currency, harmless but not what the header says.")
}

// ── 5. Terms, and what Paystack is asked for ────────────────────────────────
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
  `check-charge-currency: the currency rules pass ${ruleCases} cases (rand zone none, UK pounds, Europe euros, elsewhere dollars), ` +
  `${showing.length} files show an estimate and every one says the charge is in rand, both checkouts state ` +
  'amount, currency, frequency, cancellation and the company\'s country, and the terms agree.',
)
