import { NextResponse } from 'next/server'
import { requireAdmin, adminDb, migrationMissing } from '@/lib/admin-api'
import { buildStatement } from '@/lib/billing-docs'

// What a client owes, and how it got that way.
//
// Built from issued invoices and allocated payments only. A draft is not a
// debt, and unapplied cash is not a credit against any particular invoice, so
// neither belongs in the running balance - but the unapplied total is returned
// alongside, because a client who has overpaid needs to see that somewhere.

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const gate = await requireAdmin()
  if ('error' in gate) return gate.error

  const url = new URL(request.url)
  const clientId = url.searchParams.get('client_id')
  if (!clientId) return NextResponse.json({ error: 'Which client?' }, { status: 400 })
  const from = url.searchParams.get('from') || null

  const db = adminDb()
  const { data: client } = await db.from('billing_clients').select('*').eq('id', clientId).maybeSingle()
  if (!client) return NextResponse.json({ error: 'No such client' }, { status: 404 })

  const { data: invoices, error } = await db
    .from('invoices')
    .select('id, number, issued_at, total_cents, status')
    .eq('client_id', clientId)
    .not('status', 'in', '("draft","cancelled")')
  if (error) return migrationMissing('Statements')

  const invoiceIds = (invoices || []).map((i: any) => i.id)
  const { data: payments } = invoiceIds.length
    ? await db.from('billing_payments')
        .select('invoice_id, amount_cents, paid_on, reference').in('invoice_id', invoiceIds)
    : { data: [] }

  const { data: credits } = await db
    .from('credit_notes').select('number, issued_at, total_cents, invoice_id')
    .in('invoice_id', invoiceIds.length ? invoiceIds : ['00000000-0000-0000-0000-000000000000'])
    .eq('status', 'issued')

  const entries = [
    ...(invoices || []).map((i: any) => ({
      date: (i.issued_at || '').slice(0, 10),
      kind: 'invoice' as const,
      reference: i.number || 'Unnumbered',
      amountCents: i.total_cents || 0,
    })),
    ...(payments || []).map((p: any) => ({
      date: p.paid_on,
      kind: 'payment' as const,
      reference: p.reference || 'Payment',
      amountCents: p.amount_cents || 0,
    })),
    ...(credits || []).map((c: any) => ({
      date: (c.issued_at || '').slice(0, 10),
      kind: 'credit_note' as const,
      reference: c.number || 'Credit note',
      amountCents: c.total_cents || 0,
    })),
  ].filter(e => e.date)

  // Everything before the window collapses into the opening balance, so a
  // statement "since 1 March" still starts from what was actually owed then
  // rather than from zero.
  const before = from ? entries.filter(e => e.date < from) : []
  const within = from ? entries.filter(e => e.date >= from) : entries
  const opening = buildStatement(0, before).closingCents

  const { rows, closingCents } = buildStatement(opening, within)

  // Money received and not yet applied to anything. Not part of the balance,
  // because it settles no particular invoice, but a client looking at what they
  // owe needs to know it is sitting there.
  const { data: receipts } = await db
    .from('billing_receipts').select('id, amount_cents').eq('client_id', clientId)
  const receiptIds = (receipts || []).map((r: any) => r.id)
  const { data: allocated } = receiptIds.length
    ? await db.from('billing_payments').select('receipt_id, amount_cents').in('receipt_id', receiptIds)
    : { data: [] }
  const allocatedBy: Record<string, number> = {}
  for (const a of allocated || []) allocatedBy[a.receipt_id] = (allocatedBy[a.receipt_id] || 0) + a.amount_cents
  const unappliedCents = (receipts || [])
    .reduce((n: number, r: any) => n + Math.max(0, r.amount_cents - (allocatedBy[r.id] || 0)), 0)

  return NextResponse.json({
    client,
    openingCents: opening,
    rows,
    closingCents,
    unappliedCents,
    from,
  })
}
