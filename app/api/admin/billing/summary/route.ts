import { NextResponse } from 'next/server'
import { requireAdmin, adminDb, migrationMissing } from '@/lib/admin-api'
import { invoiceOutstanding, unallocatedCents } from '@/lib/billing-docs'
import { isQuoteExpired } from '@/lib/billing-view'

// The state of the money, in one read.
//
// This exists so the Accounting hub can lead with figures rather than links. A
// grid of pretty blocks that say "Invoices" and "Payments" is a menu; the same
// grid saying "R42 380 outstanding, R12 100 of it overdue" is the reason
// somebody opened the screen.
//
// Every number here is derived the same way the screen that owns it derives it
// - outstanding nets off credits, a lapsed quote is worked out on read - so the
// hub and the detail can never disagree.

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const gate = await requireAdmin()
  if ('error' in gate) return gate.error

  const db = adminDb()
  const today = new Date()
  const todayIso = today.toISOString().slice(0, 10)
  const monthStart = `${todayIso.slice(0, 7)}-01`

  const { data: invoices, error } = await db
    .from('invoices').select('id, status, total_cents, paid_cents, due_at, recurring_id')
  if (error) return migrationMissing()

  const ids = (invoices || []).map((i: any) => i.id)
  const [{ data: credits }, { data: quotes }, { data: receipts }, { data: schedules }, { data: clients }] =
    await Promise.all([
      ids.length
        ? db.from('credit_notes').select('invoice_id, total_cents').in('invoice_id', ids).eq('status', 'issued')
        : Promise.resolve({ data: [] }),
      db.from('quotes').select('id, status, total_cents, valid_until'),
      db.from('billing_receipts').select('id, amount_cents, received_on'),
      db.from('recurring_schedules').select('id, active'),
      db.from('billing_clients').select('id'),
    ])

  const creditedBy: Record<string, number> = {}
  for (const c of credits || []) {
    creditedBy[c.invoice_id] = (creditedBy[c.invoice_id] || 0) + (c.total_cents || 0)
  }

  let outstanding = 0, overdue = 0, overdueCount = 0
  let draftCount = 0, openCount = 0, recurringDrafts = 0
  for (const i of invoices || []) {
    if (i.status === 'draft') {
      draftCount++
      if (i.recurring_id) recurringDrafts++
      continue
    }
    if (['cancelled', 'written_off', 'credited', 'paid'].includes(i.status)) continue
    const owing = invoiceOutstanding(i.total_cents || 0, i.paid_cents || 0, creditedBy[i.id] || 0)
    if (owing <= 0) continue
    outstanding += owing
    openCount++
    if (i.due_at && String(i.due_at).slice(0, 10) < todayIso) { overdue += owing; overdueCount++ }
  }

  // Money actually received this calendar month. Receipts, not allocations: it
  // is what landed in the bank, whether or not anybody has decided yet which
  // invoice it settles.
  const collected = (receipts || [])
    .filter((r: any) => String(r.received_on).slice(0, 10) >= monthStart)
    .reduce((n: number, r: any) => n + (r.amount_cents || 0), 0)

  const receiptIds = (receipts || []).map((r: any) => r.id)
  const { data: allocations } = receiptIds.length
    ? await db.from('billing_payments').select('receipt_id, amount_cents').in('receipt_id', receiptIds)
    : { data: [] }
  const allocatedBy: Record<string, number> = {}
  for (const a of allocations || []) {
    allocatedBy[a.receipt_id] = (allocatedBy[a.receipt_id] || 0) + (a.amount_cents || 0)
  }
  const unapplied = (receipts || []).reduce((n: number, r: any) =>
    n + Math.max(0, unallocatedCents(r.amount_cents || 0,
      [{ amountCents: allocatedBy[r.id] || 0 }])), 0)

  let quotesOut = 0, quotesOutValue = 0, quotesAccepted = 0, quotesAcceptedValue = 0
  for (const q of quotes || []) {
    if (q.status === 'accepted') { quotesAccepted++; quotesAcceptedValue += q.total_cents || 0; continue }
    if (!['issued', 'sent'].includes(q.status)) continue
    if (isQuoteExpired(q, today)) continue
    quotesOut++
    quotesOutValue += q.total_cents || 0
  }

  return NextResponse.json({
    outstandingCents: outstanding,
    overdueCents: overdue,
    overdueCount,
    collectedThisMonthCents: collected,
    unappliedCents: unapplied,
    invoices: { draftCount, openCount },
    quotes: { out: quotesOut, outValueCents: quotesOutValue, accepted: quotesAccepted, acceptedValueCents: quotesAcceptedValue },
    recurring: { active: (schedules || []).filter((s: any) => s.active).length, awaitingApproval: recurringDrafts },
    clients: (clients || []).length,
  })
}
