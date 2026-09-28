// Prepaid-by-invoice teams: paid invoice in, months added, exactly once.
//
// WHAT THIS PROTECTS (built 2026-09-28 for a client paying 3 months up front,
// later 6, 12 or 36):
//   1. prepaidPeriodEnd gets the date right: extends from the later of today
//      and the date already paid to, in calendar months, clamped at month end.
//      Wrong one way and a client loses days they paid for; the other way and
//      they get time free.
//   2. Payment recording applies the period when an invoice reads as paid.
//   3. lib/prepaid claims the invoice before touching the team, so a
//      re-allocated or re-counted payment can never add the months twice,
//      and releases the claim if the team update fails.
//   4. A new prepaid team is not live until paid; an existing team switched
//      to prepaid is never taken offline by the switch.
//   5. The billing type exists in both the code and the database constraint.
//
// Run: node scripts/check-prepaid.mjs

import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, renameSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

let fail = 0
const bad = (msg) => { console.error(`  FAIL ${msg}`); fail++ }
const read = (p) => { try { return readFileSync(p, 'utf8').replace(/\r/g, '') } catch { return '' } }

// ── 1. The date arithmetic, run ─────────────────────────────────────────────
const out = mkdtempSync(join(tmpdir(), 'prepaid-'))
let B
try {
  execFileSync(process.execPath,
    ['node_modules/typescript/bin/tsc', 'lib/org-billing.ts', '--outDir', out,
     '--module', 'es2020', '--target', 'es2020', '--moduleResolution', 'node'],
    { stdio: 'pipe' })
  renameSync(join(out, 'org-billing.js'), join(out, 'org-billing.mjs'))
  B = await import(pathToFileURL(join(out, 'org-billing.mjs')).href)
} catch (e) {
  console.error('check-prepaid: could not compile lib/org-billing.ts')
  console.error(String(e.stdout || e.message).slice(0, 600))
  process.exit(1)
} finally {
  try { rmSync(out, { recursive: true, force: true }) } catch {}
}

const TODAY = new Date(2026, 8, 28) // 28 September 2026, local
const cases = [
  ['first payment, 3 months from today', B.prepaidPeriodEnd(null, 3, TODAY), '2026-12-28'],
  ['6, 12 and 36 months', [6, 12, 36].map(m => B.prepaidPeriodEnd(null, m, TODAY)).join(' '), '2027-03-28 2027-09-28 2029-09-28'],
  ['renewing early extends from the paid-until date, keeping the days left',
    B.prepaidPeriodEnd('2026-12-28', 6, TODAY), '2027-06-28'],
  ['renewing after the date passed starts from today, never backdated',
    B.prepaidPeriodEnd('2026-08-01', 3, TODAY), '2026-12-28'],
  ['month end clamps: 31 January plus one month is 28 February',
    B.prepaidPeriodEnd(null, 1, new Date(2027, 0, 31)), '2027-02-28'],
  ['leap year: 31 January 2028 plus one month is 29 February',
    B.prepaidPeriodEnd(null, 1, new Date(2028, 0, 31)), '2028-02-29'],
  ['across a year end', B.prepaidPeriodEnd(null, 3, new Date(2026, 10, 15)), '2027-02-15'],
  ['a garbage paid-until date is ignored, not obeyed', B.prepaidPeriodEnd('not a date', 3, TODAY), '2026-12-28'],
  ['days left: not prepaid is null', String(B.orgPaidUntilDaysLeft('debit_order', '2027-01-01')), 'null'],
  ['days left: prepaid without a date is null (waiting for first payment)', String(B.orgPaidUntilDaysLeft('prepaid', null)), 'null'],
]
for (const [what, got, want] of cases) {
  if (got !== want) bad(`${what}: got ${got}, expected ${want}`)
}
if (!(B.ORG_BILLING_MODES || []).includes('prepaid')) bad("ORG_BILLING_MODES no longer includes 'prepaid'.")
if (!B.BILLING_MODE_META?.prepaid?.isRevenue) bad('prepaid teams must count as revenue.')

// ── 2. Payments apply it ────────────────────────────────────────────────────
const payments = read('app/api/admin/billing/payments/route.ts')
if (!/if \(next === 'paid'\) await applyPrepaidPeriod\(db, i\.id\)/.test(payments)) {
  bad('recording a payment no longer applies the prepaid period when the invoice reads as paid, so a paid prepaid invoice switches nothing on.')
}

// ── 3. Exactly once ─────────────────────────────────────────────────────────
const lib = read('lib/prepaid.ts')
const iClaim = lib.search(/\.is\('prepaid_applied_at', null\)/)
const iOrg = lib.search(/\.from\('organizations'\)\s*\n?\s*\.update\(/)
if (iClaim < 0) bad('lib/prepaid no longer claims the invoice (prepaid_applied_at is null) before applying, so a re-run adds the months twice.')
else if (iOrg >= 0 && iOrg < iClaim) bad('lib/prepaid updates the team before claiming the invoice, so two runs at once can both add the months.')
if (!/if \(orgErr\)[\s\S]{0,300}prepaid_applied_at: null/.test(lib)) {
  bad('lib/prepaid no longer releases its claim when the team update fails, leaving a paid invoice marked applied that switched nothing on.')
}
const invoices = read('app/api/admin/billing/invoices/route.ts')
// The condition itself, not merely the column name: the refusal message
// quotes the column too, so a name-only match survives the check being gutted.
if (!/action === 'set_prepaid'[\s\S]{0,600}if \(invoice\.prepaid_applied_at\) \{/.test(invoices)) {
  bad('the invoice route lets a prepaid period be changed after it was applied, which would let the same payment be counted twice.')
}

// ── 4. Live only once paid ──────────────────────────────────────────────────
const adminRoute = read('app/api/admin/route.ts')
const prepaidBlock = adminRoute.match(/if \(billing === 'prepaid'\) \{[\s\S]*?\n    \}/)?.[0] || ''
if (!prepaidBlock) bad('create_org no longer has its prepaid block, so a new prepaid team goes live before its invoice is paid.')
else if (!/business_plan_active = existing \? \(!!existing\.business_plan_active \|\| typedIsFuture\) : typedIsFuture/.test(prepaidBlock)) {
  bad('create_org no longer decides a prepaid team\'s live state correctly: new teams wait for payment, existing live teams stay live.')
}

// ── 5. The database allows it ───────────────────────────────────────────────
const mig = read('supabase/migrations/091_prepaid_teams.sql')
if (!/check \(billing_period in \([^)]*'prepaid'/.test(mig)) bad("migration 091 no longer adds 'prepaid' to the billing_period constraint.")

if (fail) {
  console.error(`\ncheck-prepaid: ${fail} failure(s).`)
  process.exit(1)
}
console.log(`check-prepaid: the paid-until date passes ${cases.length} cases, a paid invoice applies its months exactly once, a new prepaid team waits for payment, and the database allows the billing type.`)
