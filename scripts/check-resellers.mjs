// Resellers: the pool, the month count, the monthly draft and the NFC prices.
//
// WHAT THIS PROTECTS (Andre, 2026-10-21):
//   1. R70 a seat, R50 a blank card, R125 printed, R100 shipping by default.
//   2. "Any seat live that month": a client's count for a month only goes up,
//      in SAST months, and a paused or cancelled client is not counted.
//   3. A month is drafted once per reseller, however often the cron runs, and
//      a failed draft gives the month back rather than losing it.
//   4. A reseller's client never sees a Cardtly price or a Paystack checkout,
//      and cannot pay Cardtly directly while on the reseller's bill.
//   5. The reseller page is out of the iOS app, and every reseller route is
//      scoped to the reseller the login runs.
//   6. Monthly or yearly (Andre, 2026-10-27). A yearly client is billed twelve
//      months upfront in the month its year starts and nothing more inside it,
//      seats added mid-year are billed for the months left, the year renews
//      the month after it ends, and a yearly price left blank is twelve times
//      the monthly one.
//
// Run: node scripts/check-resellers.mjs

import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, readFileSync, writeFileSync, readdirSync, renameSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

let fail = 0
const bad = (msg) => { console.error(`  FAIL ${msg}`); fail++ }
const read = (p) => { try { return readFileSync(p, 'utf8').replace(/\r/g, '') } catch { return '' } }
const eq = (got, want, what) => { if (got !== want) bad(`${what}: got ${JSON.stringify(got)}, expected ${JSON.stringify(want)}`) }

const out = mkdtempSync(join(tmpdir(), 'resellers-'))
let P, R, O
try {
  execFileSync(process.execPath,
    ['node_modules/typescript/bin/tsc', 'lib/reseller-pricing.ts', 'lib/reseller-billing.ts', 'lib/org-billing.ts', '--outDir', out,
     '--module', 'es2020', '--target', 'es2020', '--moduleResolution', 'node', '--skipLibCheck'],
    { stdio: 'pipe' })
  for (const f of readdirSync(out).filter(f => f.endsWith('.js'))) {
    writeFileSync(join(out, f), readFileSync(join(out, f), 'utf8').replace(/from '(\.\/[^']+)'/g, "from '$1.mjs'"))
    renameSync(join(out, f), join(out, f.replace(/\.js$/, '.mjs')))
  }
  P = await import(pathToFileURL(join(out, 'reseller-pricing.mjs')).href)
  R = await import(pathToFileURL(join(out, 'reseller-billing.mjs')).href)
  O = await import(pathToFileURL(join(out, 'org-billing.mjs')).href)
} catch (e) {
  console.error('check-resellers: could not compile the reseller libraries')
  console.error(String(e.stdout || e.message).slice(0, 800))
  process.exit(1)
} finally {
  try { rmSync(out, { recursive: true, force: true }) } catch {}
}

// ── 1. Prices ───────────────────────────────────────────────────────────────
eq(P.RESELLER_DEFAULTS.seatPriceCents, 7000, 'the default seat price')
eq(P.RESELLER_DEFAULTS.nfcBlankCents, 5000, 'the default blank card price')
eq(P.RESELLER_DEFAULTS.nfcPrintedCents, 12500, 'the default printed card price')
eq(P.RESELLER_DEFAULTS.nfcShippingCents, 10000, 'the default shipping per order')
eq(O.RESELLER_SEAT_RAND * 100, P.RESELLER_DEFAULTS.seatPriceCents, 'org-billing\'s reseller seat price matches lib/reseller-pricing')
if (!O.ORG_BILLING_MODES.includes('reseller')) bad("ORG_BILLING_MODES has no 'reseller'")
if (!O.BILLING_MODE_META.reseller?.isRevenue) bad('reseller teams must count as revenue')
eq(O.orgMonthlyRand(10, 'reseller'), 700, 'a 10-seat reseller team in the revenue estimate')
eq(P.randCents(7000), 'R70', 'a whole price')
eq(P.randCents(123450), 'R1 234.50', 'a price with cents')

const prices = { nfcBlankCents: 5000, nfcPrintedCents: 12500, nfcShippingCents: 10000 }
eq(P.nfcOrderTotalCents('blank', 10, prices), 60000, '10 blank cards plus shipping')
eq(P.nfcOrderTotalCents('printed', 3, prices), 47500, '3 printed cards plus shipping')
eq(P.nfcOrderLines('blank', 10, { ...prices, nfcShippingCents: 0 }).length, 1, 'no shipping line when shipping is free')
if (!/for Acme/.test(P.nfcOrderLines('printed', 2, prices, 'Acme')[0].description)) bad('a printed order line names the client')

// ── 2. Months and the pool ──────────────────────────────────────────────────
eq(P.sastMonth(new Date('2026-10-31T21:59:59Z')), '2026-10-01', '23:59 SAST on 31 October')
eq(P.sastMonth(new Date('2026-10-31T22:00:00Z')), '2026-11-01', 'midnight SAST on 1 November')
eq(P.previousMonth('2026-01-01'), '2025-12-01', 'the month before January')
eq(P.previousMonth('2026-11-01'), '2026-10-01', 'the month before November')
eq(P.monthLabel('2026-10-01'), 'October 2026', 'a month label')
eq(P.clientState({ business_plan_active: true }), 'live', 'a live client')
eq(P.clientState({ business_plan_active: true, suspended_at: '2026-10-01' }), 'paused', 'a paused client')
eq(P.clientState({ business_plan_active: false, suspended_at: '2026-10-01' }), 'cancelled', 'a cancelled client')

const clients = [
  { id: 'a', seats: 30, state: 'live' }, { id: 'b', seats: 20, state: 'paused' }, { id: 'c', seats: 40, state: 'cancelled' },
]
eq(P.seatsSold(clients), 50, 'seats sold: live and paused hold theirs, cancelled free them')
eq(P.fitsPool(100, clients, 50).ok, true, 'a new client that exactly fills the pool')
eq(P.fitsPool(100, clients, 51).ok, false, 'a new client one seat over the pool')
eq(P.fitsPool(100, clients, 80, 'a').ok, true, 'growing a client into the free seats')
eq(P.fitsPool(100, clients, 81, 'a').ok, false, 'growing a client past the pool')

const lines = P.seatInvoiceLines([
  { clientName: 'Zeta', seats: 10 }, { clientName: 'Acme', seats: 5 }, { clientName: 'Nil', seats: 0 },
], 7000, '2026-10-01')
eq(lines.length, 2, 'one line per client with seats, none for a client with none')
eq(lines[0]?.description, 'Acme: Cardtly Pro, 5 seats, October 2026', 'lines sorted by client, with the month')
eq(lines[1]?.qty, 10, 'a line\'s quantity is its seats')
eq(lines[1]?.unitPriceCents, 7000, 'a line is priced at the reseller\'s seat price')

// ── 2b. Monthly or yearly, as numbers ───────────────────────────────────────
eq(P.addMonths('2026-10-01', 11), '2027-09-01', 'eleven months on from October')
eq(P.addMonths('2026-01-01', -1), '2025-12-01', 'a month back from January')
eq(P.monthsInclusive('2027-02-01', '2027-09-01'), 8, 'February to September, both counted')
eq(P.monthsInclusive('2027-10-01', '2027-09-01'), 0, 'a range that ends before it starts')
eq(P.yearlySeatCents(7000, null), 84000, 'a yearly price left blank is twelve times the monthly')
eq(P.yearlySeatCents(7000, 70000), 70000, 'a yearly price that is set is used as it is')
eq(P.yearlySeatCents(7000, 0), 0, 'a yearly price of R0 is a price, not a blank')
eq(P.cleanTerm('yearly'), 'yearly', 'yearly is a term')
eq(P.cleanTerm('weekly'), null, 'weekly is not')

const YP = { monthlyCents: 7000, yearlyCents: 70000 }
{
  const b = P.resellerMonthBill('2026-10-01', [
    { orgId: 'm', clientName: 'Monthly Co', seats: 4, term: 'monthly' },
    { orgId: 'y', clientName: 'Yearly Co', seats: 10, term: 'yearly' },
  ], [], YP)
  eq(b.lines.length, 2, 'one line each for a monthly and a new yearly client')
  eq(b.lines[0]?.description, 'Monthly Co: Cardtly Pro, 4 seats, October 2026', 'the monthly line is unchanged')
  eq(b.lines[1]?.description, 'Yearly Co: Cardtly Pro yearly, 10 seats, October 2026 to September 2027', 'the yearly line names the twelve months it covers')
  eq(b.lines[1]?.unitPriceCents, 70000, 'a yearly seat is billed at the yearly price')
  eq(b.newYears.length, 1, 'the yearly client begins a year')
  eq(b.newYears[0]?.endMonth, '2027-09-01', 'a year begun in October ends in September')
}
const paidYear = [{ orgId: 'y', startMonth: '2026-10-01', endMonth: '2027-09-01', coveredSeats: 10 }]
{
  const inside = P.resellerMonthBill('2026-11-01', [{ orgId: 'y', clientName: 'Yearly Co', seats: 10, term: 'yearly' }], paidYear, YP)
  eq(inside.lines.length, 0, 'a month inside a paid year bills nothing')
  const fewer = P.resellerMonthBill('2027-01-01', [{ orgId: 'y', clientName: 'Yearly Co', seats: 6, term: 'yearly' }], paidYear, YP)
  eq(fewer.lines.length, 0, 'fewer seats inside a paid year are not refunded or billed')
  const more = P.resellerMonthBill('2027-02-01', [{ orgId: 'y', clientName: 'Yearly Co', seats: 12, term: 'yearly' }], paidYear, YP)
  eq(more.lines.length, 1, 'seats added inside a paid year are billed')
  eq(more.lines[0]?.qty, 2, 'only the seats above what the year covered')
  eq(more.lines[0]?.unitPriceCents, Math.round(70000 * 8 / 12), 'for the eight months the year has left, February to September')
  if (!/2 seats added to the yearly plan, February 2027 to September 2027 \(8 of 12 months\)/.test(more.lines[0]?.description || '')) bad(`the added-seats line does not say what it covers: ${more.lines[0]?.description}`)
  eq(more.extras[0]?.months, 8, 'the extra is recorded with its months')
  const switched = P.resellerMonthBill('2027-03-01', [{ orgId: 'y', clientName: 'Yearly Co', seats: 10, term: 'monthly' }], paidYear, YP)
  eq(switched.lines.length, 0, 'switching to monthly inside a paid year bills nothing until the year ends')
  const after = P.resellerMonthBill('2027-10-01', [{ orgId: 'y', clientName: 'Yearly Co', seats: 10, term: 'monthly' }], paidYear, YP)
  eq(after.lines[0]?.unitPriceCents, 7000, 'after the paid year a client switched to monthly is billed monthly')
  const renew = P.resellerMonthBill('2027-10-01', [{ orgId: 'y', clientName: 'Yearly Co', seats: 11, term: 'yearly' }], paidYear, YP)
  eq(renew.newYears[0]?.startMonth, '2027-10-01', 'a yearly client renews the month after its year ends')
  eq(renew.lines[0]?.qty, 11, 'the renewal bills the seats live in the renewal month')
}
eq(P.currentYear([{ startMonth: '2026-10-01', endMonth: '2027-09-01' }], '2027-09-01')?.endMonth, '2027-09-01', 'the last month of a year is still inside it')
eq(P.currentYear([{ startMonth: '2026-10-01', endMonth: '2027-09-01' }], '2027-10-01'), null, 'the month after a year is outside it')

// ── 3. The billing against a fake database ──────────────────────────────────
function fakeDb() {
  const t = {
    billing_settings: [{ id: true, vat_number: null, vat_rate_bp: 1500 }],
    organizations: [], resellers: [], reseller_seat_months: [], reseller_invoices: [],
    invoices: [], invoice_lines: [], document_events: [],
    reseller_client_years: [], reseller_year_extras: [],
  }
  const failNext = { invoices: false }
  let seq = 0
  const match = (row, filters) => filters.every(([op, k, v]) =>
    op === 'eq' ? row[k] === v : op === 'is' ? (row[k] ?? null) === v : op === 'in' ? v.includes(row[k]) : true)
  function builder(table) {
    const q = { op: 'select', filters: [], payload: null, single: false, returning: false }
    const run = () => {
      const rows = t[table]
      if (q.op === 'insert') {
        if (table === 'invoices' && failNext.invoices) { failNext.invoices = false; return { data: null, error: { message: 'boom' } } }
        const list = (Array.isArray(q.payload) ? q.payload : [q.payload]).map(r => ({ id: `id${++seq}`, ...r }))
        if (table === 'reseller_invoices') {
          for (const r of list) {
            if (rows.some(x => x.reseller_id === r.reseller_id && x.month === r.month)) return { data: null, error: { code: '23505', message: 'duplicate key' } }
          }
        }
        rows.push(...list)
        return { data: q.single ? list[0] : list, error: null }
      }
      if (q.op === 'update') {
        for (const r of rows.filter(r => match(r, q.filters))) Object.assign(r, q.payload)
        return { data: null, error: null }
      }
      if (q.op === 'delete') {
        t[table] = rows.filter(r => !match(r, q.filters))
        return { data: null, error: null }
      }
      const hit = rows.filter(r => match(r, q.filters))
      return { data: q.single ? hit[0] || null : hit, error: null }
    }
    const api = {
      select() { if (q.op === 'select') q.op = 'select'; q.returning = true; return api },
      insert(p) { q.op = 'insert'; q.payload = p; return api },
      update(p) { q.op = 'update'; q.payload = p; return api },
      delete() { q.op = 'delete'; return api },
      eq(k, v) { q.filters.push(['eq', k, v]); return api },
      is(k, v) { q.filters.push(['is', k, v]); return api },
      in(k, v) { q.filters.push(['in', k, v]); return api },
      maybeSingle() { q.single = true; return Promise.resolve(run()) },
      then(res, rej) { return Promise.resolve(run()).then(res, rej) },
    }
    return api
  }
  return {
    t, failNext,
    from: (table) => builder(table),
    rpc: async (name, a) => {
      if (name !== 'reseller_record_seats') return { error: { message: 'unknown rpc' } }
      const row = t.reseller_seat_months.find(r => r.reseller_id === a.p_reseller && r.organization_id === a.p_org && r.month === a.p_month)
      const term = a.p_term === 'yearly' ? 'yearly' : 'monthly'
      if (row) { row.peak_seats = Math.max(row.peak_seats, a.p_seats); row.client_name = a.p_client_name ?? row.client_name; row.term = term }
      else t.reseller_seat_months.push({ reseller_id: a.p_reseller, organization_id: a.p_org, month: a.p_month, peak_seats: Math.max(0, a.p_seats), client_name: a.p_client_name, term })
      return { error: null }
    },
  }
}

const db = fakeDb()
const reseller = { id: 'r1', name: 'Spark Marketing', billing_client_id: 'bc1', seat_price_cents: 7000 }
const quiet = { id: 'r2', name: 'Quiet Agency', billing_client_id: 'bc2', seat_price_cents: 7000 }
db.t.resellers.push(reseller, quiet)
const acme = { id: 'o1', name: 'Acme', max_seats: 10, billing_period: 'reseller', reseller_id: 'r1', business_plan_active: true }
const zeta = { id: 'o2', name: 'Zeta', max_seats: 5, billing_period: 'reseller', reseller_id: 'r1', business_plan_active: true }
const paused = { id: 'o3', name: 'Paused Ltd', max_seats: 8, billing_period: 'reseller', reseller_id: 'r1', business_plan_active: true, suspended_at: '2026-10-01' }
const direct = { id: 'o4', name: 'Direct', max_seats: 9, billing_period: 'monthly', reseller_id: 'r1', business_plan_active: true }
db.t.organizations.push(acme, zeta, paused, direct)

const oct = new Date('2026-10-15T08:00:00Z')
await R.recordClientSeats(db, acme, oct)
await R.recordClientSeats(db, { ...acme, max_seats: 4 }, oct)
const peak = () => db.t.reseller_seat_months.find(r => r.organization_id === 'o1' && r.month === '2026-10-01')?.peak_seats
eq(peak(), 10, 'cutting seats mid-month does not lower that month\'s count')
await R.recordClientSeats(db, { ...acme, max_seats: 15 }, oct)
eq(peak(), 15, 'adding seats mid-month raises that month\'s count')
await R.recordAllResellerSeats(db, oct)
if (db.t.reseller_seat_months.some(r => r.organization_id === 'o3')) bad('a paused client was counted')
if (db.t.reseller_seat_months.some(r => r.organization_id === 'o4')) bad('a team Cardtly bills directly was put on the reseller\'s invoice')
eq(db.t.reseller_seat_months.find(r => r.organization_id === 'o2')?.peak_seats, 5, 'the daily pass records a live client')

const nov1 = new Date('2026-11-01T07:00:00Z')
const first = await R.draftResellerInvoices(db, nov1)
eq(first.month, '2026-10-01', 'on 1 November the draft is for October')
eq(first.created, 1, 'one draft, for the reseller that sold seats')
eq(db.t.invoices.length, 1, 'invoices after the first run')
eq(db.t.invoices[0]?.status, 'draft', 'the monthly invoice is a draft until a person approves it')
eq(db.t.invoices[0]?.total_cents, (15 + 5) * 7000, 'the October total: every client\'s highest seats that month')
eq(db.t.invoice_lines.filter(l => l.invoice_id === db.t.invoices[0]?.id).length, 2, 'one invoice line per client')
if (db.t.reseller_invoices.some(c => c.reseller_id === 'r2')) bad('a reseller with no seats sold was claimed')

const again = await R.draftResellerInvoices(db, new Date('2026-11-02T07:00:00Z'))
eq(again.created, 0, 'a second run creates nothing')
eq(db.t.invoices.length, 1, 'October is never billed twice')

// A failed draft gives the month back.
const db2 = fakeDb()
db2.t.resellers.push(reseller)
await R.recordClientSeats(db2, acme, oct)
db2.failNext.invoices = true
const failed = await R.draftResellerMonth(db2, reseller, '2026-10-01')
if (!failed.error) bad('a failed invoice insert was reported as a success')
eq(db2.t.reseller_invoices.length, 0, 'a failed draft releases its claim')
const retried = await R.draftResellerMonth(db2, reseller, '2026-10-01')
if (!retried.invoiceId) bad('the month could not be drafted after a failure')

// A rebuild follows the counts while the invoice is a draft, and never after.
db2.t.reseller_seat_months[0].peak_seats = 12
const rebuilt = await R.rebuildResellerMonth(db2, reseller, '2026-10-01')
if (!rebuilt.invoiceId) bad(`a draft could not be rebuilt: ${rebuilt.error}`)
eq(db2.t.invoices[0]?.total_cents, 12 * 7000, 'a rebuilt draft carries the new count')
db2.t.invoices[0].status = 'sent'
const frozen = await R.rebuildResellerMonth(db2, reseller, '2026-10-01')
if (!frozen.error) bad('an issued invoice was rewritten')

const orphan = await R.draftResellerMonth(fakeDb(), { ...reseller, billing_client_id: null }, '2026-10-01')
if (!orphan.error) bad('a reseller with no billing client was drafted for')

// A yearly client through a whole year, against the fake database.
{
  const y = fakeDb()
  const res = { id: 'ry', name: 'Year Agency', billing_client_id: 'bcy', seat_price_cents: 7000, seat_price_year_cents: 70000 }
  y.t.resellers.push(res)
  const client = { id: 'oy', name: 'Annual Ltd', max_seats: 10, billing_period: 'reseller', reseller_id: 'ry', business_plan_active: true, reseller_term: 'yearly' }
  const at = (iso) => new Date(iso)
  const total = () => y.t.invoices.at(-1)?.total_cents

  await R.recordClientSeats(y, client, at('2026-10-10T08:00:00Z'))
  eq(y.t.reseller_seat_months[0]?.term, 'yearly', 'a yearly client\'s month is recorded as yearly')
  const oct = await R.draftResellerMonth(y, res, '2026-10-01')
  if (!oct.invoiceId) bad(`the first yearly month did not draft: ${oct.error || oct.skipped}`)
  eq(total(), 10 * 70000, 'October bills ten seats for a year at the yearly price')
  eq(y.t.reseller_client_years.length, 1, 'the year is recorded with the invoice')
  eq(y.t.reseller_client_years[0]?.end_month, '2027-09-01', 'the recorded year ends in September')

  await R.recordClientSeats(y, client, at('2026-11-10T08:00:00Z'))
  const nov = await R.draftResellerMonth(y, res, '2026-11-01')
  if (!nov.skipped) bad('a month inside a paid year produced an invoice')
  eq(y.t.invoices.length, 1, 'no second invoice inside the paid year')

  await R.recordClientSeats(y, { ...client, max_seats: 13 }, at('2027-02-10T08:00:00Z'))
  const feb = await R.draftResellerMonth(y, res, '2027-02-01')
  if (!feb.invoiceId) bad(`seats added mid-year were not billed: ${feb.error || feb.skipped}`)
  eq(total(), 3 * Math.round(70000 * 8 / 12), 'February bills the three added seats for the eight months left')
  eq(y.t.reseller_year_extras.length, 1, 'the added seats are recorded against the year')

  await R.recordClientSeats(y, { ...client, max_seats: 13 }, at('2027-03-10T08:00:00Z'))
  const mar = await R.draftResellerMonth(y, res, '2027-03-01')
  if (!mar.skipped) bad('seats already added to the year were billed again the next month')

  // A rebuild of February takes its extras back and writes them again, once.
  y.t.reseller_invoices = y.t.reseller_invoices.filter(c => c.month !== '2027-03-01')
  y.t.reseller_seat_months.find(r => r.month === '2027-02-01').peak_seats = 14
  const reb = await R.rebuildResellerMonth(y, res, '2027-02-01')
  if (!reb.invoiceId) bad(`a yearly month could not be rebuilt: ${reb.error}`)
  eq(y.t.reseller_year_extras.length, 1, 'a rebuild does not double the seats added to the year')
  eq(y.t.reseller_year_extras[0]?.seats, 4, 'a rebuild records the new count of added seats')

  // A rebuild is refused once a later month has been drafted from it.
  y.t.reseller_invoices.push({ reseller_id: 'ry', month: '2027-03-01', invoice_id: null })
  const blocked = await R.rebuildResellerMonth(y, res, '2027-02-01')
  if (!blocked.error) bad('a month was rebuilt after a later month had been drafted from its yearly seats')

  await R.recordClientSeats(y, { ...client, max_seats: 12 }, at('2027-10-10T08:00:00Z'))
  const renew = await R.draftResellerMonth(y, res, '2027-10-01')
  if (!renew.invoiceId) bad(`the year did not renew: ${renew.error || renew.skipped}`)
  eq(total(), 12 * 70000, 'October 2027 renews the client for a year at the seats it has then')
  eq(y.t.reseller_client_years.length, 2, 'the renewal is a second recorded year')

  // A failed invoice gives back the year it would have begun.
  const z = fakeDb()
  z.t.resellers.push(res)
  await R.recordClientSeats(z, client, at('2026-10-10T08:00:00Z'))
  z.failNext.invoices = true
  const lost = await R.draftResellerMonth(z, res, '2026-10-01')
  if (!lost.error) bad('a failed yearly draft was reported as a success')
  eq(z.t.reseller_client_years.length, 0, 'a failed draft does not leave a year behind it')
  eq(z.t.reseller_invoices.length, 0, 'a failed yearly draft releases its claim')
}

// ── 4. Wiring ───────────────────────────────────────────────────────────────
const code = (s) => s.split('\n').map(l => l.replace(/--.*$/, '')).join('\n')
const mig = code(read('supabase/migrations/094_resellers.sql'))
if (!mig) bad('migration 094 is missing')
if (!/check \(billing_period in \('monthly', 'yearly', 'debit_order', 'comp', 'trial', 'prepaid', 'reseller'\)\)/.test(mig)) bad("094 must keep every earlier billing mode and add 'reseller'")
if (!/greatest\(public\.reseller_seat_months\.peak_seats, excluded\.peak_seats\)/.test(mig)) bad('reseller_record_seats must only ever raise a month\'s count')
if (!/revoke all on function public\.reseller_record_seats[^;]*from public, anon, authenticated/.test(mig)) bad('reseller_record_seats must not be callable from the browser')
if (!/primary key \(reseller_id, month\)/.test(mig)) bad('reseller_invoices must have one row per reseller per month')
const mig97 = code(read('supabase/migrations/097_reseller_yearly.sql'))
if (!mig97) bad('migration 097 (monthly or yearly) is missing')
if (!/revoke all on function public\.reseller_record_seats\(uuid, uuid, date, integer, text, text\) from public, anon, authenticated/.test(mig97)) bad('097\'s reseller_record_seats must not be callable from the browser')
if (!/greatest\(public\.reseller_seat_months\.peak_seats, excluded\.peak_seats\)/.test(mig97)) bad('097\'s reseller_record_seats must still only ever raise a month\'s count')
for (const t of ['reseller_client_years', 'reseller_year_extras']) {
  if (!new RegExp(`alter table public\\.${t} enable row level security`).test(mig97)) bad(`${t} must have RLS on`)
}
if (!/unique \(organization_id, start_month\)/.test(mig97)) bad('a client can begin only one year in a month')
if (!/case 'set_term':/.test(read('app/api/reseller/route.ts'))) bad('a reseller cannot change how a client is sold')

const td = read('components/team/TeamDashboard.tsx')
const managedReturn = td.indexOf('if (managedBy && org && !org.business_plan_active) {')
const setup = td.indexOf('if (!org || !org.business_plan_active) {')
if (managedReturn < 0 || setup < 0 || managedReturn > setup) bad('TeamDashboard must stop a reseller\'s client before the Cardtly price list and checkout')
if (!/\.filter\(\(\[id\]\) => !\(managedBy && id === 'billing'\)\)/.test(td)) bad('TeamDashboard shows a reseller\'s client the Billing tab')
if ((td.match(/!iosApp && !managedBy/g) || []).length < 3) bad('TeamDashboard\'s Add seats button, seat upgrade and plan summary must all be hidden from a reseller\'s client')
if (!/managedBy=\{org \? await managedByFor\(/.test(read('app/dashboard/team/page.tsx'))) bad('the team page must tell TeamDashboard who manages the team')

const team = read('app/api/team/route.ts')
if (!/existing\?\.reseller_id && existing\?\.billing_period === 'reseller'/.test(team)) bad('/api/team create_org must refuse a Paystack checkout for a reseller\'s client')
if (!/org\.reseller_id && org\.billing_period === 'reseller'/.test(team)) bad('/api/team add_seats must refuse a Paystack checkout for a reseller\'s client')
if (!/billing === 'reseller' && !existing\?\.reseller_id/.test(read('app/api/admin/route.ts'))) bad('admin create_org must not put a team on reseller billing with no reseller')

if (!/'\/dashboard\/reseller'/.test(read('lib/app-platform.ts'))) bad('/dashboard/reseller must be on IOS_BLOCKED_ROUTES: it quotes Cardtly\'s prices')
if (!/const isReseller = !!reseller && !iosApp/.test(read('app/dashboard/layout.tsx'))) bad('the Reseller menu item must never show in the iOS app')

const api = read('app/api/reseller/route.ts')
if ((api.match(/const gate = await requireReseller\(\)/g) || []).length < 2) bad('every /api/reseller handler must start with requireReseller')
if (!/\.eq\('reseller_id', reseller\.id\)\.maybeSingle\(\)/.test(api)) bad('client_cards must only read a client of this reseller')
const pdf = read('app/api/reseller/invoices/pdf/route.ts')
if (!/requireReseller\(\)/.test(pdf) || !/\.eq\('client_id', reseller\.billing_client_id\)/.test(pdf) || !/invoice\.status === 'draft'/.test(pdf)) bad('a reseller may only download their own issued invoices')
const adminApi = read('app/api/admin/resellers/route.ts')
if ((adminApi.match(/const gate = await requireAdmin\(\)/g) || []).length < 3) bad('every admin reseller handler must start with requireAdmin')

const lib = read('lib/reseller.ts')
if (!/billing_period: 'reseller',[\s\S]{0,80}reseller_id: reseller\.id/.test(lib)) bad('a new client must be on this reseller\'s bill')
if ((lib.match(/await recordClientSeats\(db, saved\)/g) || []).length < 2 || !/await recordClientSeats\(db, org\)/.test(lib)) bad('adding a client, changing seats and switching a client on must record the month\'s seats straight away')
if ((lib.match(/const blocked = writable\(reseller\)/g) || []).length < 4) bad('a reseller on hold must not be able to change clients or order cards')

const cron = read('app/api/cron/trial-reminders/route.ts')
const rec = cron.indexOf('recordAllResellerSeats(admin)'), dr = cron.indexOf('draftResellerInvoices(admin)')
if (rec < 0 || dr < 0 || rec > dr) bad('the daily cron must record reseller seats and then draft last month\'s invoices')
if (!/'\/api\/reseller\/\*\*'/.test(read('next.config.js'))) bad('the reseller invoice PDF route needs the PDF fonts traced (next.config.js)')

if (fail) {
  console.error(`check-resellers: ${fail} problem(s)`)
  process.exit(1)
}
console.log('check-resellers: ok (R70/R50/R125/R100, SAST months, a month\'s count only rises, one draft per reseller per month, yearly billed upfront and not again inside the year, mid-year seats for the months left, clients see no Cardtly price, out of the iOS app)')
