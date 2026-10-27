import { documentTotals, effectiveVatRateBp, lineTotalCents } from './billing-docs'
import {
  sastMonth, previousMonth, monthLabel, clientState, resellerMonthBill, yearlySeatCents, cleanTerm,
  type InvoiceLine, type MonthBill, type PaidYear,
} from './reseller-pricing'

// What a reseller is billed, and when.
//
// DRAFTS ONLY, like lib/recurring-invoices: nothing here sends. On the 1st a
// draft appears for each reseller that sold seats the month before, and a
// person approves it, which gives it a number and emails it.
//
// HOW "ANY SEAT LIVE THAT MONTH" IS COUNTED. reseller_seat_months keeps, per
// client per month, the most seats that client had live. It is raised the
// moment a reseller adds a client or seats (lib/reseller), and again by the
// daily cron for every live client, which also catches changes made from the
// admin Teams tab. It is never lowered within a month, so taking seats away on
// the 30th does not take them off that month's invoice.
//
// IDEMPOTENCY. reseller_invoices has one row per reseller per month, claimed
// BEFORE the draft is made. A second cron run, a retry or a click on "Draft
// now" finds the claim and stops, so a month can never be billed twice. A
// failed draft gives its claim back so the next run tries again.
//
// YEARLY CLIENTS (migration 097, lib/reseller-pricing resellerMonthBill). The
// month a yearly client's year starts, its invoice bills twelve months and
// writes the year to reseller_client_years; later months read that year and
// bill only seats above it (reseller_year_extras). So months are drafted in
// order, which the daily run does by itself, and a draft is rebuilt only while
// no later month has been drafted from it.

export interface MonthResult { invoiceId?: string; skipped?: string; error?: string }

/** A draft invoice to one billing client, with its lines and an audit event.
 *  Shared by the monthly seat invoice and NFC orders. */
export async function createDraftInvoice(db: any, opts: {
  clientId: string
  lines: InvoiceLine[]
  notes: string
  event: string
  meta: Record<string, any>
  actor?: string | null
}): Promise<{ id: string; totalCents: number } | { error: string }> {
  const { data: settings } = await db
    .from('billing_settings').select('*').eq('id', true).maybeSingle()
  // Zero until Cardtly has a VAT number, whatever the settings rate says.
  const vatRateBp = effectiveVatRateBp(settings?.vat_number, settings?.vat_rate_bp)
  const totals = documentTotals(opts.lines, vatRateBp)

  const { data: invoice, error } = await db.from('invoices').insert({
    client_id: opts.clientId,
    status: 'draft',
    currency: 'ZAR',
    subtotal_cents: totals.subtotalCents,
    vat_rate_bp: totals.vatRateBp,
    vat_cents: totals.vatCents,
    total_cents: totals.totalCents,
    notes: opts.notes,
    created_by: opts.actor || null,
  }).select('id').maybeSingle()
  if (error || !invoice) return { error: error?.message || 'could not create the draft' }

  const { error: lErr } = await db.from('invoice_lines').insert(opts.lines.map((l, position) => ({
    invoice_id: invoice.id, position,
    description: l.description, qty: l.qty,
    unit_price_cents: l.unitPriceCents, line_total_cents: lineTotalCents(l),
  })))
  if (lErr) {
    // A draft with no lines is worse than no draft: it reads as R0.00 owed.
    await db.from('invoices').delete().eq('id', invoice.id).eq('status', 'draft')
    return { error: lErr.message || 'could not save the invoice lines' }
  }

  await db.from('document_events').insert({
    doc_type: 'invoice', doc_id: invoice.id, event: opts.event, actor: opts.actor || null,
    meta: { ...opts.meta, total_cents: totals.totalCents },
  })
  return { id: invoice.id, totalCents: totals.totalCents }
}

/** Raise one client's count for the month it is now. Only a live client on a
 *  reseller's bill counts. Never throws: a seat change must not fail because
 *  of this, and the daily pass records it again. */
export async function recordClientSeats(db: any, org: any, now = new Date()): Promise<void> {
  if (!org?.id || !org.reseller_id || org.billing_period !== 'reseller') return
  if (clientState(org) !== 'live') return
  const args = {
    p_reseller: org.reseller_id,
    p_org: org.id,
    p_month: sastMonth(now),
    p_seats: Math.max(0, Math.floor(Number(org.max_seats)) || 0),
    p_client_name: org.name || null,
  }
  try {
    const { error } = await db.rpc('reseller_record_seats', { ...args, p_term: cleanTerm(org.reseller_term) || 'monthly' })
    // Before migration 097 the function has no p_term. Every client is monthly
    // then, so the old call records the same thing.
    if (error && /p_term|reseller_record_seats/.test(error.message || '')) await db.rpc('reseller_record_seats', args)
  } catch { /* recorded again by the daily pass */ }
}

/** The daily pass: every live reseller client, recorded against this month. */
export async function recordAllResellerSeats(db: any, now = new Date()): Promise<{ recorded: number; problems: string[] }> {
  const out = { recorded: 0, problems: [] as string[] }
  const { data: orgs, error } = await db
    .from('organizations').select('*').eq('billing_period', 'reseller')
  if (error) {
    out.problems.push(/reseller/.test(error.message || '') ? 'Resellers need migration 094.' : `could not read client teams: ${error.message}`)
    return out
  }
  for (const org of orgs || []) {
    if (!org.reseller_id || clientState(org) !== 'live') continue
    await recordClientSeats(db, org, now)
    out.recorded++
  }
  return out
}

const missingTable = (error: any) => /reseller_client_years|reseller_year_extras/.test(error?.message || '')

export interface YearRow { id: string; organization_id: string; client_name: string | null; start_month: string; end_month: string; seats: number; unit_cents: number }
export interface ExtraRow { year_id: string; month: string; seats: number; months: number; unit_cents: number }

/** Every year this reseller's clients have been billed for, with its extras.
 *  Empty before migration 097, when nobody can have been sold yearly. */
export async function resellerYears(db: any, resellerId: string): Promise<{ years: YearRow[]; extras: ExtraRow[] } | { error: string }> {
  const { data: years, error } = await db.from('reseller_client_years').select('*').eq('reseller_id', resellerId)
  if (error) return missingTable(error) ? { years: [], extras: [] } : { error: error.message || 'could not read the paid years' }
  const ids = (years || []).map((y: any) => y.id)
  if (!ids.length) return { years: [], extras: [] }
  const { data: extras, error: eErr } = await db.from('reseller_year_extras').select('*').in('year_id', ids)
  if (eErr) return { error: eErr.message || 'could not read the seats added to paid years' }
  return { years: years || [], extras: extras || [] }
}

/** The years billed by months before `month`, as the bill reads them: each
 *  with the seats it covered by then. */
function paidBefore(years: YearRow[], extras: ExtraRow[], month: string): PaidYear[] {
  return years
    .filter(y => y.start_month < month)
    .map(y => ({
      orgId: y.organization_id,
      startMonth: y.start_month,
      endMonth: y.end_month,
      coveredSeats: (Number(y.seats) || 0) + extras
        .filter(e => e.year_id === y.id && e.month < month)
        .reduce((n, e) => n + (Number(e.seats) || 0), 0),
    }))
}

export function resellerPrices(reseller: any): { monthlyCents: number; yearlyCents: number } {
  const monthlyCents = Number(reseller?.seat_price_cents) || 0
  return { monthlyCents, yearlyCents: yearlySeatCents(monthlyCents, reseller?.seat_price_year_cents) }
}

/** One month's bill for one reseller, worked out from the seat counts and the
 *  years paid before it. Reads only. */
async function monthBillFor(db: any, reseller: any, month: string): Promise<{ bill: MonthBill; years: YearRow[] } | { error: string }> {
  // '*' rather than a column list, so this still reads before migration 097
  // added the term column.
  const { data: rows, error } = await db
    .from('reseller_seat_months').select('*').eq('reseller_id', reseller.id).eq('month', month)
  if (error) return { error: error.message || 'could not read the seat counts' }
  const paid = await resellerYears(db, reseller.id)
  if ('error' in paid) return { error: paid.error }
  const bill = resellerMonthBill(
    month,
    (rows || []).map((r: any) => ({
      orgId: r.organization_id, clientName: r.client_name,
      seats: Number(r.peak_seats) || 0, term: cleanTerm(r.term) || 'monthly',
    })),
    paidBefore(paid.years, paid.extras, month),
    resellerPrices(reseller),
  )
  return { bill, years: paid.years }
}

/** Write the years and extras a month's bill begins. Returns an error, after
 *  undoing whatever it wrote, if any of it fails. */
async function saveYears(db: any, reseller: any, bill: MonthBill, years: YearRow[]): Promise<string | null> {
  if (bill.newYears.length) {
    const { error } = await db.from('reseller_client_years').insert(bill.newYears.map(y => ({
      reseller_id: reseller.id, organization_id: y.orgId, client_name: y.clientName,
      start_month: y.startMonth, end_month: y.endMonth, seats: y.seats, unit_cents: y.unitCents,
    })))
    if (error) return missingTable(error) ? 'Yearly billing needs migration 097. Run it in Supabase, then draft again.' : (error.message || 'could not save the yearly terms')
  }
  if (bill.extras.length) {
    const rows = bill.extras.map(e => {
      const year = years.find(y => y.organization_id === e.orgId && y.start_month === e.yearStart)
      return year ? { year_id: year.id, month: e.month, seats: e.seats, months: e.months, unit_cents: e.unitCents } : null
    }).filter(Boolean)
    const { error } = rows.length ? await db.from('reseller_year_extras').insert(rows) : { error: null }
    if (error) {
      await unsaveYears(db, reseller, bill.newYears[0]?.startMonth || bill.extras[0].month, years)
      return error.message || 'could not save the seats added to paid years'
    }
  }
  return null
}

/** Take back what one month's bill wrote: the years it began and the extras it
 *  added to earlier years. */
async function unsaveYears(db: any, reseller: any, month: string, years: YearRow[]): Promise<void> {
  try {
    await db.from('reseller_client_years').delete().eq('reseller_id', reseller.id).eq('start_month', month)
    const earlier = years.filter(y => y.start_month < month).map(y => y.id)
    if (earlier.length) await db.from('reseller_year_extras').delete().in('year_id', earlier).eq('month', month)
  } catch { /* before migration 097 there is nothing to take back */ }
}

/** What a month comes to so far, for the reseller's and the admin's screens. */
export async function estimateResellerMonth(db: any, reseller: any, month: string): Promise<{ cents: number; seats: number }> {
  const res = await monthBillFor(db, reseller, month)
  if ('error' in res) return { cents: 0, seats: 0 }
  return {
    cents: res.bill.lines.reduce((n, l) => n + lineTotalCents(l), 0),
    seats: res.bill.lines.reduce((n, l) => n + l.qty, 0),
  }
}

function seatNotes(reseller: any, month: string): string {
  return `Cardtly seats sold through ${reseller.name}, ${monthLabel(month)}. One line per client. Monthly clients: a seat live at any time in the month is billed for the whole month. Yearly clients: twelve months are billed upfront in the month the year starts, and seats added during a paid year are billed for the months it has left.`
}

/** Draft one reseller's invoice for one month (YYYY-MM-01). */
export async function draftResellerMonth(db: any, reseller: any, month: string, actor?: string | null): Promise<MonthResult> {
  if (!reseller?.billing_client_id) return { error: `${reseller?.name || 'Reseller'} has no billing client, so there is nobody to invoice` }

  const res = await monthBillFor(db, reseller, month)
  if ('error' in res) return { error: res.error }
  const { bill, years } = res
  const lines = bill.lines
  // Also the month every client was inside a year it had already paid for.
  if (!lines.length) return { skipped: 'nothing to bill that month' }

  // The claim first. A duplicate key means this month is already drafted.
  const { error: claimErr } = await db.from('reseller_invoices').insert({ reseller_id: reseller.id, month })
  if (claimErr) {
    if (claimErr.code === '23505') return { skipped: 'already drafted' }
    return { error: claimErr.message || 'could not claim the month' }
  }
  const release = () => db.from('reseller_invoices').delete().eq('reseller_id', reseller.id).eq('month', month).is('invoice_id', null)

  // The years before the invoice: an invoice that billed a year with no record
  // of it would let next month bill those seats monthly as well.
  const yearsErr = await saveYears(db, reseller, bill, years)
  if (yearsErr) {
    await release()
    return { error: yearsErr }
  }

  const made = await createDraftInvoice(db, {
    clientId: reseller.billing_client_id,
    lines,
    notes: seatNotes(reseller, month),
    event: 'drafted_reseller_month',
    meta: {
      reseller_id: reseller.id, reseller: reseller.name, month, seats: lines.reduce((n, l) => n + l.qty, 0),
      years_started: bill.newYears.length, seats_added_to_years: bill.extras.reduce((n, e) => n + e.seats, 0),
    },
    actor,
  })
  if ('error' in made) {
    // Give the month back, or it would never be billed, and the years with it.
    await unsaveYears(db, reseller, month, years)
    await release()
    return { error: made.error }
  }
  await db.from('reseller_invoices').update({ invoice_id: made.id }).eq('reseller_id', reseller.id).eq('month', month)
  return { invoiceId: made.id }
}

/** Refresh a month's draft from the counts as they are now. Only while it is
 *  still a draft: an issued invoice is frozen and is corrected with a credit
 *  note, never by rewriting it. */
export async function rebuildResellerMonth(db: any, reseller: any, month: string): Promise<MonthResult> {
  const { data: claim } = await db
    .from('reseller_invoices').select('invoice_id').eq('reseller_id', reseller.id).eq('month', month).maybeSingle()
  if (!claim?.invoice_id) return draftResellerMonth(db, reseller, month)

  const { data: invoice } = await db.from('invoices').select('id, status').eq('id', claim.invoice_id).maybeSingle()
  if (!invoice) return { error: 'that month\'s invoice no longer exists' }
  if (invoice.status !== 'draft') return { error: 'that month\'s invoice is already issued, so it cannot change. Raise a credit note instead.' }

  // A later month read this month's yearly terms when it was drafted, so
  // changing them now would leave that one wrong.
  const { data: later } = await db.from('reseller_invoices').select('month').eq('reseller_id', reseller.id)
  const laterMonth = (later || []).map((c: any) => c.month).filter((m: string) => m > month).sort()[0]
  const before = await resellerYears(db, reseller.id)
  if ('error' in before) return { error: before.error }
  const touchesYears = before.years.some(y => y.start_month === month) || before.extras.some(e => e.month === month)
  if (laterMonth && touchesYears) {
    return { error: `${monthLabel(laterMonth)} has already been drafted from this month's yearly terms. Cancel that draft first, rebuild this one, then draft it again.` }
  }

  // Take back what the first draft wrote, then work the month out again.
  await unsaveYears(db, reseller, month, before.years)
  const res = await monthBillFor(db, reseller, month)
  if ('error' in res) return { error: res.error }
  const lines = res.bill.lines
  if (!lines.length) return { error: 'nothing is billable that month any more, so there is nothing to bill. Cancel the draft instead.' }
  if (laterMonth && (res.bill.newYears.length || res.bill.extras.length)) {
    return { error: `This month would now begin a yearly term, but ${monthLabel(laterMonth)} is already drafted without it. Cancel that draft first, rebuild this one, then draft it again.` }
  }
  const yearsErr = await saveYears(db, reseller, res.bill, res.years)
  if (yearsErr) return { error: yearsErr }

  const { data: settings } = await db.from('billing_settings').select('*').eq('id', true).maybeSingle()
  const totals = documentTotals(lines, effectiveVatRateBp(settings?.vat_number, settings?.vat_rate_bp))
  await db.from('invoice_lines').delete().eq('invoice_id', invoice.id)
  await db.from('invoice_lines').insert(lines.map((l, position) => ({
    invoice_id: invoice.id, position,
    description: l.description, qty: l.qty,
    unit_price_cents: l.unitPriceCents, line_total_cents: lineTotalCents(l),
  })))
  await db.from('invoices').update({
    subtotal_cents: totals.subtotalCents, vat_rate_bp: totals.vatRateBp,
    vat_cents: totals.vatCents, total_cents: totals.totalCents,
    notes: seatNotes(reseller, month), updated_at: new Date().toISOString(),
  }).eq('id', invoice.id).eq('status', 'draft')
  return { invoiceId: invoice.id }
}

/** The daily pass: last month's draft for every reseller that sold seats in
 *  it. Runs every day, so a missed 1st is picked up on the 2nd. */
export async function draftResellerInvoices(db: any, now = new Date()): Promise<{ month: string; created: number; skipped: number; problems: string[] }> {
  const month = previousMonth(sastMonth(now))
  const out = { month, created: 0, skipped: 0, problems: [] as string[] }
  const { data: resellers, error } = await db.from('resellers').select('*')
  if (error) {
    out.problems.push(/resellers/.test(error.message || '') ? 'Resellers need migration 094.' : `could not read resellers: ${error.message}`)
    return out
  }
  for (const r of resellers || []) {
    const res = await draftResellerMonth(db, r, month)
    if (res.invoiceId) out.created++
    else if (res.skipped) out.skipped++
    else if (res.error) out.problems.push(`${r.name}: ${res.error}`)
  }
  return out
}
