// Does the billing arithmetic add up?
//
// An invoice that is one cent out is an invoice that gets queried, and the
// query arrives weeks later from a customer's bookkeeper rather than from a
// test. The properties checked here are the ones a person actually verifies
// when they read a document:
//
//   - the subtotal equals the sum of the line totals AS PRINTED
//   - the total equals the subtotal plus the VAT AS PRINTED
//   - nothing is a floating point number pretending to be money
//   - a business with no VAT number never issues a "Tax Invoice"
//
// Run: node scripts/check-billing-maths.mjs

import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, renameSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const out = mkdtempSync(join(tmpdir(), 'billing-'))
let M
try {
  execFileSync(
    process.execPath,
    ['node_modules/typescript/bin/tsc', 'lib/billing-docs.ts', '--outDir', out,
     '--module', 'es2020', '--target', 'es2020', '--moduleResolution', 'node'],
    { stdio: 'pipe' },
  )
  renameSync(join(out, 'billing-docs.js'), join(out, 'billing-docs.mjs'))
  M = await import(pathToFileURL(join(out, 'billing-docs.mjs')).href)
} catch (e) {
  console.error('check-billing-maths: could not compile lib/billing-docs.ts')
  console.error(String(e.stdout || e.message).slice(0, 600))
  process.exit(1)
}

let fail = 0
const bad = (msg) => { console.error(`  FAIL ${msg}`); fail++ }
const eq = (label, got, want) => {
  if (got !== want) bad(`${label}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`)
}

// ── The reconciliation property, over many shapes ─────────────────────────
// Random-ish but deterministic: awkward quantities and prices that do not
// divide cleanly, which is where a rounding rule shows itself.
const QTYS = [1, 2, 3, 0.5, 1.5, 2.25, 0.333, 7, 12, 0.001]
const PRICES = [1, 7, 99, 9700, 15000, 12345, 33333, 1, 250, 199999]
let shapes = 0
for (const rate of [0, 1500]) {
  for (let i = 0; i < QTYS.length; i++) {
    for (let j = 0; j < PRICES.length; j++) {
      const lines = [
        { description: 'a', qty: QTYS[i], unitPriceCents: PRICES[j] },
        { description: 'b', qty: QTYS[(i + 3) % QTYS.length], unitPriceCents: PRICES[(j + 5) % PRICES.length] },
        { description: 'c', qty: QTYS[(i + 7) % QTYS.length], unitPriceCents: PRICES[(j + 2) % PRICES.length] },
      ]
      const t = M.documentTotals(lines, rate)
      shapes++

      const printedLines = lines.map(l => M.lineTotalCents(l))
      const sumOfPrinted = printedLines.reduce((a, b) => a + b, 0)

      if (t.subtotalCents !== sumOfPrinted) {
        bad(`subtotal does not equal the printed lines: ${t.subtotalCents} vs ${sumOfPrinted}`)
      }
      if (t.totalCents !== t.subtotalCents + t.vatCents) {
        bad(`total does not equal subtotal + VAT: ${t.totalCents} vs ${t.subtotalCents}+${t.vatCents}`)
      }
      for (const v of [t.subtotalCents, t.vatCents, t.totalCents, ...printedLines]) {
        if (!Number.isInteger(v)) bad(`money is not an integer number of cents: ${v}`)
      }
      if (rate === 0 && t.vatCents !== 0) bad(`unregistered document carries VAT: ${t.vatCents}`)
    }
  }
}

// ── VAT, on and off ───────────────────────────────────────────────────────
const hundred = [{ description: 'x', qty: 1, unitPriceCents: 10000 }]
eq('VAT off: total', M.documentTotals(hundred, 0).totalCents, 10000)
eq('VAT off: vat', M.documentTotals(hundred, 0).vatCents, 0)
eq('VAT 15%: vat on R100', M.documentTotals(hundred, 1500).vatCents, 1500)
eq('VAT 15%: total on R100', M.documentTotals(hundred, 1500).totalCents, 11500)
// A rate that does not divide cleanly still lands on a whole cent.
const odd = M.documentTotals([{ description: 'x', qty: 1, unitPriceCents: 3333 }], 1500)
eq('VAT on R33.33 rounds to a cent', odd.vatCents, 500)
eq('VAT on R33.33: total', odd.totalCents, 3833)

// ── Wording ───────────────────────────────────────────────────────────────
eq('not registered: invoice', M.documentTitle('invoice', null), 'INVOICE')
eq('not registered: blank vat number', M.documentTitle('invoice', '   '), 'INVOICE')
eq('registered: tax invoice', M.documentTitle('invoice', '4123456789'), 'TAX INVOICE')
eq('not registered: credit note', M.documentTitle('credit_note', null), 'CREDIT NOTE')
eq('registered: credit note', M.documentTitle('credit_note', '4123456789'), 'TAX CREDIT NOTE')
eq('a quote is always a quotation', M.documentTitle('quote', '4123456789'), 'QUOTATION')

// ── Display ───────────────────────────────────────────────────────────────
eq('formats cents', M.formatMoney(0), 'R0.00')
eq('formats a round amount', M.formatMoney(9700), 'R97.00')
// A non-breaking space, deliberately, so the amount cannot wrap mid-number.
eq('groups thousands', M.formatMoney(123456789), 'R1 234 567.89')
eq('separator is non-breaking', M.formatMoney(123456789).includes(' '), true)
eq('separator is never a plain space', M.formatMoney(123456789).includes(' 234'), false)
eq('keeps the sign', M.formatMoney(-9700), '-R97.00')

// ── Due dates ─────────────────────────────────────────────────────────────
eq('14 day terms', M.dueDateFrom(new Date('2026-09-04T10:00:00Z'), 14), '2026-09-18')
eq('crosses a month end', M.dueDateFrom(new Date('2026-01-25T10:00:00Z'), 14), '2026-02-08')
eq('same day terms', M.dueDateFrom(new Date('2026-09-04T10:00:00Z'), 0), '2026-09-04')

// ── Payment status ────────────────────────────────────────────────────────
const TODAY = new Date('2026-09-04T00:00:00Z')
eq('unpaid and not yet due', M.statusAfterPayment(10000, 0, '2026-09-30', TODAY), 'sent')
eq('unpaid and overdue', M.statusAfterPayment(10000, 0, '2026-08-01', TODAY), 'overdue')
eq('part paid', M.statusAfterPayment(10000, 4000, '2026-09-30', TODAY), 'part_paid')
eq('paid exactly', M.statusAfterPayment(10000, 10000, '2026-09-30', TODAY), 'paid')
eq('overpaid still counts as paid', M.statusAfterPayment(10000, 12000, '2026-09-30', TODAY), 'paid')
eq('part paid beats overdue', M.statusAfterPayment(10000, 4000, '2026-08-01', TODAY), 'part_paid')

// ── Statements ────────────────────────────────────────────────────────────
const st = M.buildStatement(0, [
  { date: '2026-07-01', kind: 'invoice', reference: 'INV-2026-0001', amountCents: 10000 },
  { date: '2026-07-15', kind: 'payment', reference: 'EFT', amountCents: 4000 },
  { date: '2026-08-01', kind: 'invoice', reference: 'INV-2026-0002', amountCents: 5000 },
  { date: '2026-08-20', kind: 'credit_note', reference: 'CN-2026-0001', amountCents: 1000 },
])
eq('statement closes correctly', st.closingCents, 10000)
eq('statement rows', st.rows.length, 4)
eq('running balance after the first payment', st.rows[1].balanceCents, 6000)
// An invoice raised and settled the same day must not read as a credit first.
const sameDay = M.buildStatement(0, [
  { date: '2026-07-01', kind: 'payment', reference: 'EFT', amountCents: 10000 },
  { date: '2026-07-01', kind: 'invoice', reference: 'INV-1', amountCents: 10000 },
])
eq('same-day invoice sorts before its payment', sameDay.rows[0].kind, 'invoice')
eq('same-day balance never goes negative', sameDay.rows[0].balanceCents, 10000)

// ── Anniversary billing ───────────────────────────────────────────────────
eq('quote validity', M.QUOTE_VALID_DAYS, 14)
eq('ordinary anniversary', M.anniversaryOn(2026, 8, 5), '2026-09-05')
// The 29th, 30th and 31st do not exist in every month.
eq('31st clamps in February', M.anniversaryOn(2026, 1, 31), '2026-02-28')
eq('31st clamps in a leap February', M.anniversaryOn(2028, 1, 31), '2028-02-29')
eq('31st clamps in a 30 day month', M.anniversaryOn(2026, 8, 31), '2026-09-30')
eq('31st survives a 31 day month', M.anniversaryOn(2026, 9, 31), '2026-10-31')
eq('next anniversary later this month', M.nextAnniversary(new Date('2026-09-01T10:00:00Z'), 5), '2026-09-05')
eq('next anniversary rolls forward', M.nextAnniversary(new Date('2026-09-05T10:00:00Z'), 5), '2026-10-05')
eq('next anniversary crosses the year', M.nextAnniversary(new Date('2026-12-20T10:00:00Z'), 5), '2027-01-05')

// ── When things fall due ──────────────────────────────────────────────────
eq('an NFC order is due immediately',
   M.dueDateFor('once_off', new Date('2026-09-15T10:00:00Z')), '2026-09-15')
eq('a subscription is due on its anniversary',
   M.dueDateFor('subscription', new Date('2026-09-28T10:00:00Z'), { anniversaryDay: 5 }), '2026-10-05')
eq('a subscription with no anniversary falls back to the issue date',
   M.dueDateFor('subscription', new Date('2026-09-15T10:00:00Z')), '2026-09-15')

// ── Pro rata ──────────────────────────────────────────────────────────────
// A 5th-to-5th cycle in September is 30 days.
eq('a change on the first day is the whole period',
   M.proRataCents(9700, '2026-09-05', '2026-09-05', '2026-10-05'), 9700)
eq('a change on the last day is nothing',
   M.proRataCents(9700, '2026-10-05', '2026-09-05', '2026-10-05'), 0)
eq('20 of 30 days', M.proRataCents(9700, '2026-09-15', '2026-09-05', '2026-10-05'), 6467)
eq('a change dated before the period cannot exceed it',
   M.proRataCents(9700, '2025-01-01', '2026-09-05', '2026-10-05'), 9700)
eq('a nonsense period charges nothing',
   M.proRataCents(9700, '2026-09-15', '2026-10-05', '2026-09-05'), 0)

// ── Seat changes ──────────────────────────────────────────────────────────
const up = M.seatChange({ fromSeats: 10, toSeats: 15, seatPriceCents: 9700,
  changeOn: '2026-09-15', periodStart: '2026-09-05', periodEnd: '2026-10-05' })
eq('adding seats charges now', up.direction, 'increase')
eq('5 seats for 20 of 30 days', up.chargeNowCents, 32333)
eq('next month bills 15 seats', up.nextPeriodCents, 145500)

const down = M.seatChange({ fromSeats: 15, toSeats: 10, seatPriceCents: 9700,
  changeOn: '2026-09-15', periodStart: '2026-09-05', periodEnd: '2026-10-05' })
eq('removing seats charges nothing now', down.chargeNowCents, 0)
eq('removing seats is a decrease', down.direction, 'decrease')
eq('next month bills 10 seats', down.nextPeriodCents, 97000)

const same = M.seatChange({ fromSeats: 10, toSeats: 10, seatPriceCents: 9700,
  changeOn: '2026-09-15', periodStart: '2026-09-05', periodEnd: '2026-10-05' })
eq('no change charges nothing', same.chargeNowCents, 0)
eq('no change still states the recurring amount', same.nextPeriodCents, 97000)
// The whole point: the next invoice follows the seat count without anyone
// editing a template.
for (const n of [1, 3, 7, 20, 250]) {
  const r = M.seatChange({ fromSeats: 0, toSeats: n, seatPriceCents: 9700,
    changeOn: '2026-09-05', periodStart: '2026-09-05', periodEnd: '2026-10-05' })
  if (r.nextPeriodCents !== n * 9700) bad(`recurring amount wrong at ${n} seats: ${r.nextPeriodCents}`)
}

// ── VAT may only be charged by somebody registered to charge it ───────────
// billing_settings defaults the rate to 1500 with no VAT number, which is
// exactly the state Cardtly is in while the application is in. Reading the
// rate straight off settings there produces an INVOICE that adds 15%.
eq('no VAT number, no VAT', M.effectiveVatRateBp(null, 1500), 0)
eq('blank VAT number, no VAT', M.effectiveVatRateBp('   ', 1500), 0)
eq('registered, rate applies', M.effectiveVatRateBp('4123456789', 1500), 1500)
eq('registered but zero rated', M.effectiveVatRateBp('4123456789', 0), 0)
eq('nonsense rate is not charged', M.effectiveVatRateBp('4123456789', NaN), 0)
// The two must agree: an unregistered document says INVOICE and carries no VAT.
{
  const vat = null
  const totals = M.documentTotals([{ description: 'x', qty: 1, unitPriceCents: 10000 }], M.effectiveVatRateBp(vat, 1500))
  eq('unregistered document title', M.documentTitle('invoice', vat), 'INVOICE')
  eq('unregistered document VAT', totals.vatCents, 0)
  eq('unregistered document total', totals.totalCents, 10000)
}

// ── The letterhead's own terms ────────────────────────────────────────────
// "Invoice due date: last day of each month". The month length has to come
// out of the calendar, not out of a guess.
eq('end of a 30-day month', M.endOfMonthDue(new Date('2026-09-04T00:00:00Z')), '2026-09-30')
eq('end of a 31-day month', M.endOfMonthDue(new Date('2026-01-01T00:00:00Z')), '2026-01-31')
eq('end of February', M.endOfMonthDue(new Date('2026-02-14T00:00:00Z')), '2026-02-28')
eq('end of a leap February', M.endOfMonthDue(new Date('2028-02-14T00:00:00Z')), '2028-02-29')
eq('end of December', M.endOfMonthDue(new Date('2026-12-31T00:00:00Z')), '2026-12-31')
// Issued ON the last day: due that day, not rolled into next month.
eq('issued on the last day', M.endOfMonthDue(new Date('2026-09-30T00:00:00Z')), '2026-09-30')

const ISSUE = new Date('2026-09-17T00:00:00Z')
eq('rule end_of_month', M.defaultDueDate('end_of_month', ISSUE, 14), '2026-09-30')
eq('rule days', M.defaultDueDate('days', ISSUE, 14), '2026-10-01')
eq('rule on_issue', M.defaultDueDate('on_issue', ISSUE, 14), '2026-09-17')
// The two rules genuinely differ, which is the reason the column exists.
if (M.defaultDueDate('end_of_month', ISSUE, 14) === M.defaultDueDate('days', ISSUE, 14)) {
  bad('end_of_month and days must not collapse to the same date')
}
// "Quote valid 14 days".
eq('quote validity', M.quoteValidUntil(new Date('2026-09-04T00:00:00Z')), '2026-09-18')
eq('quote validity, overridden', M.quoteValidUntil(new Date('2026-09-04T00:00:00Z'), 30), '2026-10-04')

// ── Snapshots carry the fields a document cannot be rendered without ──────
const snap = M.bankSnapshot({ bank_name: 'FNB', bank_account_name: 'Cardtly', bank_account_no: '123', bank_branch_code: '250655' })
for (const k of ['bankName', 'accountName', 'accountNumber', 'branchCode', 'accountType', 'swift']) {
  if (!(k in snap)) bad(`bank snapshot is missing ${k}`)
}
const from = M.fromSnapshot({ legal_name: 'Cardtly', vat_number: null })
if (!('vatNumber' in from)) bad('from snapshot must carry vatNumber, or the title cannot be reproduced later')
// The letterhead prints the website next to the phone and the email. A
// document that lists two of the three reads truncated.
if (!('website' in from)) bad('from snapshot must carry website, which the letterhead prints')

rmSync(out, { recursive: true, force: true })
if (fail) {
  console.error(`\ncheck-billing-maths: ${fail} failure(s).`)
  process.exit(1)
}
console.log(
  `check-billing-maths: ${shapes} document shapes reconcile ` +
  `(subtotal equals its printed lines, total equals subtotal plus VAT, all integer cents), ` +
  `plus wording, due dates, payment status and statement balances.`,
)
