import { NextResponse } from 'next/server'
import { requireAdmin, adminDb, migrationMissing } from '@/lib/admin-api'
import {
  documentTotals, effectiveVatRateBp, statusAfterPayment, invoiceOutstanding,
  fromSnapshot,
} from '@/lib/billing-docs'

// Credit notes: the only lawful way to correct an issued invoice.
//
// An issued invoice cannot be edited - the database refuses it, not just this
// code - because a document somebody has already received must not change
// underneath them. Correcting it means issuing a second document that says how
// much of the first one is being taken back, and leaving both on the books.
// That is what an auditor expects to see and what a client can reconcile.
//
// A credit note reduces what is OWED without being a payment. No money moved,
// so it must never make an invoice read as paid.

export const runtime = 'nodejs'

/** How much of an invoice has already been credited. */
async function creditedCents(db: any, invoiceId: string, excludeId?: string): Promise<number> {
  const { data } = await db
    .from('credit_notes').select('id, total_cents, status').eq('invoice_id', invoiceId)
  return (data || [])
    // A draft credit note is not a credit yet, the same way a draft invoice is
    // not a debt.
    .filter((c: any) => c.status === 'issued' && c.id !== excludeId)
    .reduce((n: number, c: any) => n + (c.total_cents || 0), 0)
}

async function restatusInvoice(db: any, invoiceId: string) {
  const { data: inv } = await db
    .from('invoices').select('id, total_cents, paid_cents, due_at, status').eq('id', invoiceId).maybeSingle()
  if (!inv || ['draft', 'cancelled', 'written_off'].includes(inv.status)) return
  const credited = await creditedCents(db, invoiceId)
  const next = statusAfterPayment(inv.total_cents, inv.paid_cents, inv.due_at, new Date(), credited)
  if (next !== inv.status) {
    await db.from('invoices').update({ status: next, updated_at: new Date().toISOString() }).eq('id', invoiceId)
  }
}

export async function GET(request: Request) {
  const gate = await requireAdmin()
  if ('error' in gate) return gate.error

  const url = new URL(request.url)
  const invoiceId = url.searchParams.get('invoice_id')
  const db = adminDb()

  let q = db.from('credit_notes').select('*').order('created_at', { ascending: false }).limit(200)
  if (invoiceId) q = q.eq('invoice_id', invoiceId)
  const { data, error } = await q
  if (error) return migrationMissing('Credit notes')

  const invIds = [...new Set((data || []).map((c: any) => c.invoice_id))]
  const { data: invoices } = invIds.length
    ? await db.from('invoices').select('id, number, total_cents, client_id').in('id', invIds)
    : { data: [] }
  const invById = Object.fromEntries((invoices || []).map((i: any) => [i.id, i]))
  const { data: clients } = await db.from('billing_clients').select('id, name')
  const clientName = Object.fromEntries((clients || []).map((c: any) => [c.id, c.name]))

  return NextResponse.json({
    creditNotes: (data || []).map((c: any) => ({
      ...c,
      invoice_number: invById[c.invoice_id]?.number || null,
      invoice_total_cents: invById[c.invoice_id]?.total_cents || 0,
      client_name: clientName[invById[c.invoice_id]?.client_id] || 'Unknown client',
    })),
  })
}

/** Raise a draft credit note against an issued invoice. */
export async function POST(request: Request) {
  const gate = await requireAdmin()
  if ('error' in gate) return gate.error

  const body = await request.json().catch(() => ({}))
  if (!body?.invoice_id) return NextResponse.json({ error: 'Which invoice?' }, { status: 400 })

  const db = adminDb()
  const { data: invoice } = await db
    .from('invoices').select('*').eq('id', body.invoice_id).maybeSingle()
  if (!invoice) return NextResponse.json({ error: 'No such invoice' }, { status: 404 })

  if (!invoice.number || invoice.status === 'draft') {
    return NextResponse.json({
      error: 'This invoice is still a draft. Edit it directly rather than crediting it: there is nothing out there to correct.',
    }, { status: 409 })
  }
  if (invoice.status === 'cancelled') {
    return NextResponse.json({ error: `Invoice ${invoice.number} is cancelled.` }, { status: 409 })
  }

  const reason = String(body.reason || '').trim()
  if (!reason) {
    return NextResponse.json({
      error: 'Say what is being credited and why. A credit note with no reason is one nobody can account for later.',
    }, { status: 400 })
  }

  // Default to the whole invoice, which is the common case: cancelling one
  // that should never have gone out.
  const requested = body.amount_cents == null
    ? invoice.total_cents
    : Math.round(Number(body.amount_cents))
  if (!Number.isFinite(requested) || requested <= 0) {
    return NextResponse.json({ error: 'A credit note needs an amount.' }, { status: 400 })
  }

  const already = await creditedCents(db, invoice.id)
  if (already + requested > invoice.total_cents) {
    return NextResponse.json({
      error: `That would credit more than the invoice. It is ${invoice.total_cents} cents, ${already} is already credited, so at most ${invoice.total_cents - already} can be credited now.`,
    }, { status: 400 })
  }

  // The invoice's own rate, not today's. A credit against a document issued
  // before VAT registration must not carry VAT the original never charged.
  const vatRateBp = Number(invoice.vat_rate_bp) || 0
  // The requested figure is the gross amount being taken back, so the net is
  // worked back out of it rather than added on top.
  const subtotal = vatRateBp > 0 ? Math.round(requested / (1 + vatRateBp / 10000)) : requested
  const totals = documentTotals([{ description: reason, qty: 1, unitPriceCents: subtotal }], vatRateBp)

  const { data: note, error } = await db.from('credit_notes').insert({
    invoice_id: invoice.id,
    status: 'draft',
    reason,
    subtotal_cents: totals.subtotalCents,
    vat_rate_bp: totals.vatRateBp,
    vat_cents: totals.vatCents,
    total_cents: totals.totalCents,
    created_by: gate.user.id,
  }).select('*').maybeSingle()

  if (error) {
    if (/relation .* does not exist/i.test(error.message || '')) return migrationMissing('Credit notes')
    return NextResponse.json({ error: error.message || 'Could not raise the credit note' }, { status: 500 })
  }

  await db.from('document_events').insert({
    doc_type: 'credit_note', doc_id: note.id, event: 'created', actor: gate.user.id,
    meta: { invoice_id: invoice.id, invoice_number: invoice.number, amount_cents: totals.totalCents },
  })

  return NextResponse.json({ creditNote: note })
}

/** Issue it, or discard the draft. */
export async function PATCH(request: Request) {
  const gate = await requireAdmin()
  if ('error' in gate) return gate.error

  const body = await request.json().catch(() => ({}))
  if (!body?.id) return NextResponse.json({ error: 'Which credit note?' }, { status: 400 })

  const db = adminDb()
  const { data: note } = await db.from('credit_notes').select('*').eq('id', body.id).maybeSingle()
  if (!note) return NextResponse.json({ error: 'No such credit note' }, { status: 404 })

  if (body.action === 'discard') {
    if (note.status === 'issued') {
      return NextResponse.json({
        error: `Credit note ${note.number} is issued and cannot be removed. It is part of the record now.`,
      }, { status: 409 })
    }
    await db.from('credit_notes').delete().eq('id', note.id)
    return NextResponse.json({ ok: true })
  }

  if (note.status === 'issued') {
    return NextResponse.json({ error: `Credit note ${note.number} is already issued.` }, { status: 409 })
  }

  const { data: invoice } = await db
    .from('invoices').select('*').eq('id', note.invoice_id).maybeSingle()
  if (!invoice) return NextResponse.json({ error: 'The invoice has gone.' }, { status: 404 })

  // Re-checked at issue, not only at draft: another credit note may have been
  // issued in between.
  const already = await creditedCents(db, invoice.id, note.id)
  if (already + note.total_cents > invoice.total_cents) {
    return NextResponse.json({
      error: `Another credit note has been issued since this draft was raised. Only ${invoice.total_cents - already} cents can still be credited.`,
    }, { status: 409 })
  }

  const { data: number, error: nErr } = await db.rpc('next_document_number', { p_doc_type: 'credit_note' })
  if (nErr || !number) {
    return NextResponse.json({ error: 'Could not allocate a credit note number.' }, { status: 500 })
  }

  const { data: settings } = await db.from('billing_settings').select('*').eq('id', true).maybeSingle()
  const issuedAt = new Date()

  const { data: issued, error } = await db.from('credit_notes').update({
    number,
    status: 'issued',
    issued_at: issuedAt.toISOString(),
    // The INVOICE's sender, not today's settings: a credit note corrects a
    // specific document and has to look like it came from the same place.
    from_snapshot: invoice.from_snapshot || fromSnapshot(settings || {}),
    to_snapshot: invoice.to_snapshot,
  }).eq('id', note.id).select('*').maybeSingle()

  if (error) return NextResponse.json({ error: error.message || 'Could not issue' }, { status: 500 })

  await db.from('document_events').insert({
    doc_type: 'credit_note', doc_id: note.id, event: 'issued', actor: gate.user.id,
    meta: { number, invoice_id: invoice.id, invoice_number: invoice.number, amount_cents: note.total_cents },
  })

  await restatusInvoice(db, invoice.id)

  const { data: after } = await db
    .from('invoices').select('total_cents, paid_cents, status').eq('id', invoice.id).maybeSingle()
  const credited = await creditedCents(db, invoice.id)

  return NextResponse.json({
    creditNote: issued,
    invoice: {
      status: after?.status,
      outstanding_cents: invoiceOutstanding(after?.total_cents || 0, after?.paid_cents || 0, credited),
      credited_cents: credited,
    },
  })
}
