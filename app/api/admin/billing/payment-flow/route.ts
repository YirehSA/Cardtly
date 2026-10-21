import { NextResponse } from 'next/server'
import { requireAdmin, adminDb, migrationMissing } from '@/lib/admin-api'
import { invoiceOutstanding, unallocatedCents } from '@/lib/billing-docs'
import { quoteDisplayStatus } from '@/lib/billing-view'

// What a payment could be for, in one read, for the Payment received screen.
//
// Reads only. Every change the screen makes goes through the routes that
// already own it (team setup, quotes, invoices, payments), so their checks
// still apply and nothing here can drift from them. See lib/payment-flow for
// the order those calls run in.

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const OPEN = ['issued', 'sent', 'part_paid', 'overdue']

export async function GET() {
  const gate = await requireAdmin()
  if ('error' in gate) return gate.error

  const db = adminDb()

  const { data: clients, error: cErr } = await db
    .from('billing_clients').select('id, name, contact_person, email, phone, organization_id').order('name')
  if (cErr) return migrationMissing('Payments')

  // select('*') so a team read does not fail before migration 094 adds reseller_id.
  const { data: teams } = await db.from('organizations').select('*').order('name')

  // Quotes a client could be paying: out with them or signed, and not yet
  // turned into an invoice. Once invoiced, it is the invoice that gets paid.
  const { data: quotes } = await db
    .from('quotes').select('*').in('status', ['issued', 'sent', 'accepted'])
    .order('issued_at', { ascending: false }).limit(200)
  const { data: invoices } = await db
    .from('invoices').select('*').in('status', ['draft', ...OPEN])
    .order('created_at', { ascending: false }).limit(300)
  const { data: converted } = await db
    .from('invoices').select('from_quote_id').not('from_quote_id', 'is', null)
  const invoiced = new Set((converted || []).map((i: any) => i.from_quote_id))
  const openQuotes = (quotes || []).filter((q: any) => !invoiced.has(q.id))

  const quoteIds = openQuotes.map((q: any) => q.id)
  const invoiceIds = (invoices || []).map((i: any) => i.id)
  const [{ data: qLines }, { data: iLines }, { data: credits }] = await Promise.all([
    quoteIds.length
      ? db.from('quote_lines').select('quote_id, description, qty, unit_price_cents, position').in('quote_id', quoteIds).order('position')
      : Promise.resolve({ data: [] }),
    invoiceIds.length
      ? db.from('invoice_lines').select('invoice_id, description, qty, unit_price_cents, position').in('invoice_id', invoiceIds).order('position')
      : Promise.resolve({ data: [] }),
    invoiceIds.length
      ? db.from('credit_notes').select('invoice_id, total_cents').in('invoice_id', invoiceIds).eq('status', 'issued')
      : Promise.resolve({ data: [] }),
  ])
  const linesOf = (rows: any[], key: string, id: string) => rows
    .filter(l => l[key] === id)
    .map(l => ({ description: l.description, qty: Number(l.qty), unit_price_cents: l.unit_price_cents }))
  const creditedBy: Record<string, number> = {}
  for (const c of credits || []) creditedBy[c.invoice_id] = (creditedBy[c.invoice_id] || 0) + (c.total_cents || 0)

  // Money already loaded and not yet given a home: the screen offers these
  // instead of recording the same bank line twice.
  const { data: receipts } = await db
    .from('billing_receipts').select('*').order('received_on', { ascending: false }).limit(300)
  const receiptIds = (receipts || []).map((r: any) => r.id)
  const { data: allocations } = receiptIds.length
    ? await db.from('billing_payments').select('receipt_id, invoice_id, amount_cents').in('receipt_id', receiptIds)
    : { data: [] }
  const allocatedTo: Record<string, number> = {}
  for (const a of allocations || []) allocatedTo[a.receipt_id] = (allocatedTo[a.receipt_id] || 0) + (a.amount_cents || 0)

  return NextResponse.json({
    clients: clients || [],
    teams: (teams || []).map((t: any) => ({
      id: t.id, name: t.name, max_seats: t.max_seats, billing_period: t.billing_period,
      business_plan_active: !!t.business_plan_active, paid_until: t.paid_until ?? null,
      admin_user_id: t.admin_user_id, reseller_id: t.reseller_id ?? null,
    })),
    quotes: openQuotes.map((q: any) => ({
      id: q.id, number: q.number, client_id: q.client_id, status: q.status,
      display_status: quoteDisplayStatus(q), total_cents: q.total_cents,
      issued_at: q.issued_at, valid_until: q.valid_until,
      accepted_at: q.accepted_at, accepted_name: q.accepted_name, accepted_email: q.accepted_email,
      lines: linesOf(qLines || [], 'quote_id', q.id),
    })),
    invoices: (invoices || []).map((i: any) => ({
      id: i.id, number: i.number, client_id: i.client_id, status: i.status,
      total_cents: i.total_cents, paid_cents: i.paid_cents || 0, credited_cents: creditedBy[i.id] || 0,
      outstanding_cents: invoiceOutstanding(i.total_cents || 0, i.paid_cents || 0, creditedBy[i.id] || 0),
      issued_at: i.issued_at, due_at: i.due_at, from_quote_id: i.from_quote_id,
      prepaid_months: i.prepaid_months ?? null, prepaid_applied_at: i.prepaid_applied_at ?? null,
      lines: linesOf(iLines || [], 'invoice_id', i.id),
    })),
    receipts: (receipts || [])
      .map((r: any) => ({
        id: r.id, client_id: r.client_id, amount_cents: r.amount_cents, received_on: r.received_on,
        method: r.method, reference: r.reference,
        unallocated_cents: unallocatedCents(r.amount_cents || 0, [{ amountCents: allocatedTo[r.id] || 0 }]),
        // What it already pays. Allocating replaces a receipt's allocations
        // wholesale, so adding one has to send these back with it.
        allocations: (allocations || []).filter((a: any) => a.receipt_id === r.id)
          .map((a: any) => ({ invoice_id: a.invoice_id, amount_cents: a.amount_cents })),
      }))
      .filter((r: any) => r.unallocated_cents > 0),
  })
}
