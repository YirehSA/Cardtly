// Does the recurring machinery bill each thing exactly once?
//
// The arithmetic is covered by check-billing-maths. This checks the WIRING,
// which is where the money actually goes wrong:
//
//   - the monthly pass run twice must raise one invoice, not two
//   - a mid-cycle seat increase must raise ONE pro-rata charge, and running
//     daily for the rest of the month must raise no more
//   - a decrease must raise nothing and refund nothing
//   - the cycle must advance from the DUE DATE, so a late run does not drag it
//
// Both passes ride a daily cron that can retry, overlap, and be triggered by
// hand from the admin screen at the same time. Billing a client twice is the
// worst thing this code can do, so it is worth a fake database to prove it
// does not.
//
// Run: node scripts/check-recurring.mjs

import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const out = mkdtempSync(join(tmpdir(), 'recur-'))
let M
try {
  execFileSync(
    process.execPath,
    ['node_modules/typescript/bin/tsc', 'lib/recurring-invoices.ts', '--outDir', out,
     '--module', 'commonjs', '--target', 'es2020', '--moduleResolution', 'node', '--skipLibCheck'],
    { stdio: 'pipe' },
  )
  M = await import(pathToFileURL(join(out, 'recurring-invoices.js')).href)
} catch (e) {
  console.error('check-recurring: could not compile lib/recurring-invoices.ts')
  console.error(String(e.stdout || e.message).slice(0, 800))
  rmSync(out, { recursive: true, force: true })
  process.exit(1)
}

let fail = 0
const bad = (msg) => { console.error(`  FAIL ${msg}`); fail++ }
const eq = (label, got, want) => {
  if (got !== want) bad(`${label}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`)
}

/**
 * Just enough of the Supabase query builder for these two functions.
 *
 * Deliberately in-memory rather than against the real database: the point is to
 * run the same pass ten times over and count rows, which is not something to do
 * to production books.
 */
function fakeDb(tables) {
  const uid = (() => { let n = 0; return () => `id-${++n}` })()

  function builder(name) {
    const rows = () => (tables[name] ||= [])
    const state = { filters: [], order: null, limit: null, single: false, op: 'select' }
    let payload = null

    const match = (r) => state.filters.every(f => {
      const v = r[f.col]
      if (f.kind === 'eq') return v === f.val
      if (f.kind === 'neq') return v !== f.val
      if (f.kind === 'in') return f.val.includes(v)
      if (f.kind === 'notnull') return v !== null && v !== undefined
      return true
    })

    const run = () => {
      if (state.op === 'insert') {
        const list = Array.isArray(payload) ? payload : [payload]
        const made = list.map(r => ({ id: uid(), ...r }))
        rows().push(...made)
        return { data: state.single ? made[0] : made, error: null }
      }
      if (state.op === 'update') {
        const hit = rows().filter(match)
        for (const r of hit) Object.assign(r, payload)
        return { data: state.single ? hit[0] || null : hit, error: null }
      }
      if (state.op === 'delete') {
        const keep = rows().filter(r => !match(r))
        const removed = rows().length - keep.length
        tables[name] = keep
        return { data: null, error: null, count: removed }
      }
      let hit = rows().filter(match)
      if (state.order) {
        const { col, asc } = state.order
        hit = [...hit].sort((a, b) => (a[col] < b[col] ? -1 : a[col] > b[col] ? 1 : 0) * (asc ? 1 : -1))
      }
      if (state.limit != null) hit = hit.slice(0, state.limit)
      return { data: state.single ? hit[0] || null : hit, error: null }
    }

    const api = {
      select() { return api },
      insert(v) { state.op = 'insert'; payload = v; return api },
      update(v) { state.op = 'update'; payload = v; return api },
      delete() { state.op = 'delete'; return api },
      eq(col, val) { state.filters.push({ kind: 'eq', col, val }); return api },
      neq(col, val) { state.filters.push({ kind: 'neq', col, val }); return api },
      in(col, val) { state.filters.push({ kind: 'in', col, val }); return api },
      not(col, _op, _val) { state.filters.push({ kind: 'notnull', col }); return api },
      order(col, opts) { state.order = { col, asc: opts?.ascending !== false }; return api },
      limit(n) { state.limit = n; return api },
      maybeSingle() { state.single = true; return Promise.resolve(run()) },
      then(res, rej) { return Promise.resolve(run()).then(res, rej) },
    }
    return api
  }

  return { from: builder, __tables: tables }
}

const SETTINGS = [{ id: true, vat_number: null, vat_rate_bp: 1500 }]

function world({ seats = 10, lastSeats = 10, lastAdjusted = 10, nextRun = '2026-10-05', lead = 7 } = {}) {
  return fakeDb({
    billing_settings: [...SETTINGS],
    organizations: [{ id: 'org1', name: 'Acme', max_seats: seats }],
    recurring_schedules: [{
      id: 'sch1', client_id: 'cli1', organization_id: 'org1', name: 'Acme seats',
      source: 'seats', cadence: 'monthly', day_of_month: 5, next_run_on: nextRun,
      active: true, seat_price_cents: 9700, lead_days: lead,
      last_seats: lastSeats, last_adjusted_seats: lastAdjusted, template: [],
    }],
    invoices: [{
      id: 'inv-prev', recurring_id: 'sch1', client_id: 'cli1',
      status: 'draft', due_at: '2026-09-05', total_cents: 97000,
    }],
    invoice_lines: [],
    document_events: [],
  })
}

// ── The monthly pass is idempotent ────────────────────────────────────────
{
  const db = world({ nextRun: '2026-10-05' })
  const before = db.__tables.invoices.length
  const a = await M.generateRecurringDrafts(db, new Date('2026-10-01T00:00:00Z'))
  eq('one draft raised', a.created, 1)
  const b = await M.generateRecurringDrafts(db, new Date('2026-10-01T00:00:00Z'))
  eq('a second run raises nothing', b.created, 0)
  const c = await M.generateRecurringDrafts(db, new Date('2026-10-02T00:00:00Z'))
  eq('and nor does a third, the next day', c.created, 0)
  eq('exactly one invoice added', db.__tables.invoices.length - before, 1)
  eq('the cycle advanced from the due date',
    db.__tables.recurring_schedules[0].next_run_on, '2026-11-05')
}

// ── Two runs overlapping ──────────────────────────────────────────────────
// The case the duplicate guard actually exists for, and the one the test above
// does NOT reach: once a schedule has advanced, the lead-time check turns the
// second run away before the guard is consulted. The dangerous shape is a
// schedule still pointing at a due date that already has an invoice - the cron
// mid-flight when somebody presses Check now, or an advance that failed.
{
  const db = world({ nextRun: '2026-10-05' })
  // Exactly what run A leaves behind between creating the invoice and
  // advancing the schedule.
  db.__tables.invoices.push({
    id: 'inv-in-flight', recurring_id: 'sch1', client_id: 'cli1',
    status: 'draft', due_at: '2026-10-05', total_cents: 97000,
  })
  const before = db.__tables.invoices.length
  const r = await M.generateRecurringDrafts(db, new Date('2026-10-01T00:00:00Z'))
  eq('an overlapping run raises nothing', r.created, 0)
  eq('and it says it skipped', r.skipped, 1)
  eq('no second invoice for the same period', db.__tables.invoices.length, before)
}

// ── A late run does not drag the cycle ────────────────────────────────────
{
  const db = world({ nextRun: '2026-10-05' })
  await M.generateRecurringDrafts(db, new Date('2026-10-19T00:00:00Z')) // a fortnight late
  eq('a late run still bills the 5th',
    db.__tables.recurring_schedules[0].next_run_on, '2026-11-05')
}

// ── A seat increase raises one pro-rata charge, once ──────────────────────
{
  // Period 5 Sep to 5 Oct. Seats 10 -> 15 on 15 Sep: 20 of 30 days left.
  const db = world({ seats: 15, lastSeats: 10, lastAdjusted: 10, nextRun: '2026-10-05' })
  const a = await M.adjustSeatChanges(db, new Date('2026-09-15T00:00:00Z'))
  eq('one adjustment raised', a.raised, 1)
  eq('it is an increase', a.changes[0].direction, 'increase')
  // 5 extra seats * R97 = R485 for 20 of 30 days = R323.33
  eq('charged pro rata for the days left', a.changes[0].chargeNowCents, 32333)

  const draft = db.__tables.invoices.find(i => i.due_at === '2026-09-15')
  if (!draft) bad('the adjustment draft was not created')
  else {
    eq('the adjustment is a draft', draft.status, 'draft')
    eq('due immediately', draft.due_at, '2026-09-15')
    // VAT is zero because there is no VAT number, same rule as everywhere else.
    eq('adjustment total', draft.total_cents, 32333)
  }

  // The whole point: run it again, and again, and it must do nothing.
  for (const day of ['2026-09-15', '2026-09-16', '2026-09-20', '2026-10-01']) {
    const again = await M.adjustSeatChanges(db, new Date(`${day}T00:00:00Z`))
    if (again.raised !== 0) bad(`a repeat run on ${day} raised ${again.raised} more adjustments`)
  }
  eq('still exactly one adjustment invoice',
    db.__tables.invoices.filter(i => i.due_at === '2026-09-15').length, 1)
  eq('the marker closed the gap',
    db.__tables.recurring_schedules[0].last_adjusted_seats, 15)
}

// ── A decrease charges nothing and refunds nothing ────────────────────────
{
  const db = world({ seats: 6, lastSeats: 10, lastAdjusted: 10, nextRun: '2026-10-05' })
  const before = db.__tables.invoices.length
  const a = await M.adjustSeatChanges(db, new Date('2026-09-15T00:00:00Z'))
  eq('nothing raised for a decrease', a.raised, 0)
  eq('but it is recorded', a.recorded, 1)
  eq('it is a decrease', a.changes[0].direction, 'decrease')
  eq('no invoice either way', db.__tables.invoices.length, before)
  eq('the marker still closed', db.__tables.recurring_schedules[0].last_adjusted_seats, 6)

  // And next month bills the new number without anybody editing anything.
  await M.generateRecurringDrafts(db, new Date('2026-10-01T00:00:00Z'))
  const monthly = db.__tables.invoices.find(i => i.due_at === '2026-10-05')
  eq('next month bills the reduced count', monthly.total_cents, 6 * 9700)
}

// ── No change, no noise ───────────────────────────────────────────────────
{
  const db = world({ seats: 10, lastSeats: 10, lastAdjusted: 10 })
  const a = await M.adjustSeatChanges(db, new Date('2026-09-15T00:00:00Z'))
  eq('an unchanged seat count raises nothing', a.raised, 0)
  eq('and records nothing', a.recorded, 0)
  eq('and reports nothing', a.changes.length, 0)
}

// ── An increase that lands on the last day is not a zero invoice ──────────
{
  const db = world({ seats: 15, lastSeats: 10, lastAdjusted: 10, nextRun: '2026-10-05' })
  const a = await M.adjustSeatChanges(db, new Date('2026-10-05T00:00:00Z'))
  eq('no charge for zero days remaining', a.raised, 0)
  if (db.__tables.invoices.some(i => i.total_cents === 0)) bad('a zero-value invoice was raised')
}

// ── A schedule that has never billed cannot be pro-rated ──────────────────
{
  const db = world({ seats: 15, lastSeats: null, lastAdjusted: null })
  const a = await M.adjustSeatChanges(db, new Date('2026-09-15T00:00:00Z'))
  eq('nothing raised before the first invoice', a.raised, 0)
  eq('but the baseline is recorded',
    db.__tables.recurring_schedules[0].last_adjusted_seats, 15)
}

rmSync(out, { recursive: true, force: true })
if (fail) {
  console.error(`\ncheck-recurring: ${fail} failure(s).`)
  process.exit(1)
}
console.log(
  'check-recurring: the monthly pass bills once however often it runs, a late run does not shift the ' +
  'cycle, a seat increase raises exactly one pro-rata charge and repeat runs raise none, and a ' +
  'decrease charges nothing while the next month follows the new count.',
)
