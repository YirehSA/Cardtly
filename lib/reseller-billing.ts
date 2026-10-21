import { documentTotals, effectiveVatRateBp, lineTotalCents } from './billing-docs'
import {
  sastMonth, previousMonth, monthLabel, seatInvoiceLines, clientState,
  type InvoiceLine,
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
  try {
    await db.rpc('reseller_record_seats', {
      p_reseller: org.reseller_id,
      p_org: org.id,
      p_month: sastMonth(now),
      p_seats: Math.max(0, Math.floor(Number(org.max_seats)) || 0),
      p_client_name: org.name || null,
    })
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

async function seatLinesFor(db: any, reseller: any, month: string): Promise<InvoiceLine[] | { error: string }> {
  const { data: rows, error } = await db
    .from('reseller_seat_months').select('organization_id, client_name, peak_seats')
    .eq('reseller_id', reseller.id).eq('month', month)
  if (error) return { error: error.message || 'could not read the seat counts' }
  return seatInvoiceLines(
    (rows || []).map((r: any) => ({ clientName: r.client_name, seats: Number(r.peak_seats) || 0 })),
    Number(reseller.seat_price_cents) || 0,
    month,
  )
}

function seatNotes(reseller: any, month: string): string {
  return `Cardtly seats sold through ${reseller.name}, ${monthLabel(month)}. One line per client: a seat live at any time in the month is billed for the whole month.`
}

/** Draft one reseller's invoice for one month (YYYY-MM-01). */
export async function draftResellerMonth(db: any, reseller: any, month: string, actor?: string | null): Promise<MonthResult> {
  if (!reseller?.billing_client_id) return { error: `${reseller?.name || 'Reseller'} has no billing client, so there is nobody to invoice` }

  const lines = await seatLinesFor(db, reseller, month)
  if ('error' in lines) return { error: lines.error }
  if (!lines.length) return { skipped: 'no seats sold that month' }

  // The claim first. A duplicate key means this month is already drafted.
  const { error: claimErr } = await db.from('reseller_invoices').insert({ reseller_id: reseller.id, month })
  if (claimErr) {
    if (claimErr.code === '23505') return { skipped: 'already drafted' }
    return { error: claimErr.message || 'could not claim the month' }
  }

  const made = await createDraftInvoice(db, {
    clientId: reseller.billing_client_id,
    lines,
    notes: seatNotes(reseller, month),
    event: 'drafted_reseller_month',
    meta: { reseller_id: reseller.id, reseller: reseller.name, month, seats: lines.reduce((n, l) => n + l.qty, 0) },
    actor,
  })
  if ('error' in made) {
    // Give the month back, or it would never be billed.
    await db.from('reseller_invoices').delete().eq('reseller_id', reseller.id).eq('month', month).is('invoice_id', null)
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

  const lines = await seatLinesFor(db, reseller, month)
  if ('error' in lines) return { error: lines.error }
  if (!lines.length) return { error: 'no seats were sold that month, so there is nothing to bill. Cancel the draft instead.' }

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
