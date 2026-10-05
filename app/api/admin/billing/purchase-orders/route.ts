import { NextResponse } from 'next/server'
import { randomBytes } from 'node:crypto'
import { requireAdmin, adminDb, migrationMissing } from '@/lib/admin-api'
import {
  fromSnapshot, toSnapshot, signatureCopies, isSignaturePng,
} from '@/lib/billing-docs'

// Purchase orders: raised from an invoice (or a quote), approved by the
// client's department manager.
//
// Some clients' accounts departments cannot pay without one. Cardtly drafts it
// with the same lines and money as the invoice, addressed with the client's
// CURRENT details, and the manager signs it through a link
// (/po/<token>, app/api/po/[token]) - or on paper, in which case the
// signature they send back is recorded here. The PDF carries both sides.
//
// A purchase order authorises a purchase; it does not ask for money. So it has
// no banking details and no payment reference, and creating one changes
// nothing about the invoice except, when it has none, the order number the
// invoice quotes back.

export const runtime = 'nodejs'

const mintToken = () => randomBytes(16).toString('hex')
const clean = (v: unknown, max: number) =>
  typeof v === 'string' ? v.trim().slice(0, max) || null : null

/** Without the signature images, which only the PDF needs. */
function forScreen(po: any) {
  const { signature_png, supplier_signatures, ...rest } = po || {}
  return {
    ...rest,
    has_signature: !!signature_png,
    supplier_signed_by: Array.isArray(supplier_signatures) ? supplier_signatures.map((x: any) => x?.name).filter(Boolean) : [],
  }
}

export async function GET(request: Request) {
  const gate = await requireAdmin()
  if ('error' in gate) return gate.error

  const url = new URL(request.url)
  const id = url.searchParams.get('id')
  const invoiceId = url.searchParams.get('invoice_id')
  const db = adminDb()

  if (id) {
    const { data: po, error } = await db.from('purchase_orders').select('*').eq('id', id).maybeSingle()
    if (error) return migrationMissing('Purchase orders')
    if (!po) return NextResponse.json({ error: 'No such purchase order' }, { status: 404 })
    const { data: lines } = await db
      .from('purchase_order_lines').select('*').eq('purchase_order_id', id).order('position')
    return NextResponse.json({ purchaseOrder: forScreen(po), lines: lines || [] })
  }

  let q = db.from('purchase_orders').select('*').order('created_at', { ascending: false }).limit(200)
  if (invoiceId) q = q.eq('invoice_id', invoiceId)
  const { data, error } = await q
  if (error) return migrationMissing('Purchase orders')
  return NextResponse.json({ purchaseOrders: (data || []).map(forScreen) })
}

/** Raise one from an invoice or a quote. */
export async function POST(request: Request) {
  const gate = await requireAdmin()
  if ('error' in gate) return gate.error

  const body = await request.json().catch(() => ({}))
  const db = adminDb()

  // The source: its lines and money are copied, never re-typed.
  let source: any = null
  let sourceLines: any[] = []
  let sourceLabel = ''
  let invoiceId: string | null = null
  let quoteId: string | null = null

  if (body?.invoice_id) {
    const { data } = await db.from('invoices').select('*').eq('id', body.invoice_id).maybeSingle()
    if (!data) return NextResponse.json({ error: 'No such invoice' }, { status: 404 })
    if (data.status === 'cancelled') return NextResponse.json({ error: `Invoice ${data.number} is cancelled.` }, { status: 409 })
    source = data
    invoiceId = data.id
    sourceLabel = data.number ? `Invoice ${data.number}` : 'Draft invoice'
    sourceLines = (await db.from('invoice_lines').select('*').eq('invoice_id', data.id).order('position')).data || []
  } else if (body?.quote_id) {
    const { data } = await db.from('quotes').select('*').eq('id', body.quote_id).maybeSingle()
    if (!data) return NextResponse.json({ error: 'No such quote' }, { status: 404 })
    if (['draft', 'declined', 'cancelled'].includes(data.status)) {
      return NextResponse.json({ error: `Quote ${data.number || ''} is ${data.status}; raise the purchase order from an issued or accepted quote.`.replace('  ', ' ') }, { status: 409 })
    }
    source = data
    quoteId = data.id
    sourceLabel = `Quotation ${data.number}`
    sourceLines = (await db.from('quote_lines').select('*').eq('quote_id', data.id).order('position')).data || []
  } else {
    return NextResponse.json({ error: 'Raise a purchase order from an invoice or a quote.' }, { status: 400 })
  }
  if (!sourceLines.length) return NextResponse.json({ error: `${sourceLabel} has no lines to order.` }, { status: 400 })

  const { data: client } = await db.from('billing_clients').select('*').eq('id', source.client_id).maybeSingle()
  if (!client) return NextResponse.json({ error: 'That document has no client.' }, { status: 400 })
  const { data: settings, error: sErr } = await db.from('billing_settings').select('*').eq('id', true).maybeSingle()
  if (sErr) return migrationMissing()

  // Cardtly's side, signed by whoever was chosen, or by whoever signs invoices.
  const ids: string[] = Array.isArray(body?.signatory_ids) ? body.signatory_ids.filter((x: unknown) => typeof x === 'string') : []
  const peopleQ = db.from('billing_signatories').select('*').order('position')
  const { data: people } = ids.length ? await peopleQ.in('id', ids) : await peopleQ.eq('sign_invoices', true)
  const issuedAt = new Date()
  const supplierSignatures = signatureCopies(people || [], issuedAt)

  const { data: number, error: nErr } = await db.rpc('next_document_number', { p_doc_type: 'purchase_order' })
  if (nErr || !number) {
    return NextResponse.json({
      error: /purchase_order|doc_type/.test(nErr?.message || '')
        ? 'Migration 092 has not been run yet, so purchase orders cannot be numbered.'
        : 'Could not allocate a purchase order number.',
    }, { status: 500 })
  }

  const { data: po, error } = await db.from('purchase_orders').insert({
    number,
    status: 'awaiting_signature',
    client_id: source.client_id,
    invoice_id: invoiceId,
    quote_id: quoteId,
    source_label: sourceLabel,
    buyer_reference: clean(body?.buyer_reference, 80),
    issued_at: issuedAt.toISOString(),
    currency: source.currency || 'ZAR',
    subtotal_cents: source.subtotal_cents || 0,
    vat_rate_bp: source.vat_rate_bp || 0,
    vat_cents: source.vat_cents || 0,
    total_cents: source.total_cents || 0,
    notes: clean(body?.notes, 1000),
    // The client as they are NOW, not as the invoice remembers them: a
    // purchase order made out to an old registered name is no use to anybody.
    buyer_snapshot: toSnapshot(client),
    supplier_snapshot: fromSnapshot(settings || {}),
    supplier_signatures: supplierSignatures.length ? supplierSignatures : null,
    approver_role: clean(body?.approver_role, 80) || 'Department Manager',
    approver_name: clean(body?.approver_name, 120),
    approver_email: clean(body?.approver_email, 200),
    public_token: mintToken(),
    created_by: gate.user.id,
  }).select('*').maybeSingle()
  if (error || !po) return NextResponse.json({ error: error?.message || 'Could not raise the purchase order' }, { status: 500 })

  await db.from('purchase_order_lines').insert(sourceLines.map((l: any, position: number) => ({
    purchase_order_id: po.id, position,
    description: l.description, qty: l.qty,
    unit_price_cents: l.unit_price_cents, line_total_cents: l.line_total_cents,
  })))

  await db.from('document_events').insert({
    doc_type: 'purchase_order', doc_id: po.id, event: 'created', actor: gate.user.id,
    meta: { number, source: sourceLabel },
  })

  // The invoice quotes the order back, unless it already quotes one (the
  // client's own number, typed in by hand, wins).
  if (invoiceId && !source.po_number) {
    await db.from('invoices').update({ po_number: number, updated_at: new Date().toISOString() }).eq('id', invoiceId)
  }

  return NextResponse.json({ purchaseOrder: forScreen(po) })
}

/** Update an unsigned one, record a paper signature, or cancel. */
export async function PATCH(request: Request) {
  const gate = await requireAdmin()
  if ('error' in gate) return gate.error

  const body = await request.json().catch(() => ({}))
  if (!body?.id) return NextResponse.json({ error: 'Which purchase order?' }, { status: 400 })
  const db = adminDb()
  const { data: po, error: pErr } = await db.from('purchase_orders').select('*').eq('id', body.id).maybeSingle()
  if (pErr) return migrationMissing('Purchase orders')
  if (!po) return NextResponse.json({ error: 'No such purchase order' }, { status: 404 })
  const now = new Date().toISOString()

  if (body.action === 'cancel') {
    await db.from('purchase_orders').update({ status: 'cancelled', updated_at: now }).eq('id', po.id)
    await db.from('document_events').insert({ doc_type: 'purchase_order', doc_id: po.id, event: 'cancelled', actor: gate.user.id })
    return NextResponse.json({ ok: true })
  }

  // Once signed it is the approval itself, so it is frozen like any other
  // signed document. A change after that is a new purchase order.
  if (po.status !== 'awaiting_signature') {
    return NextResponse.json({ error: `${po.number} is ${po.status.replace('_', ' ')} and can no longer be changed. Raise a new one.` }, { status: 409 })
  }

  // The manager signed on paper and sent it back: record that signature.
  if (body.action === 'record_signature') {
    const name = clean(body.signer_name, 120)
    if (!name) return NextResponse.json({ error: 'Who signed it?' }, { status: 400 })
    if (!isSignaturePng(body.signature_png)) {
      return NextResponse.json({ error: 'Upload or draw the signature they sent back.' }, { status: 400 })
    }
    const { error } = await db.from('purchase_orders').update({
      status: 'signed',
      signer_name: name,
      signer_title: clean(body.signer_title, 120) || po.approver_role,
      signer_email: clean(body.signer_email, 200),
      signature_png: body.signature_png,
      signed_at: now,
      signed_via: 'recorded',
      updated_at: now,
    }).eq('id', po.id).eq('status', 'awaiting_signature')
    if (error) return NextResponse.json({ error: error.message || 'Could not record it' }, { status: 500 })
    await db.from('document_events').insert({
      doc_type: 'purchase_order', doc_id: po.id, event: 'signature_recorded', actor: gate.user.id,
      meta: { name, title: clean(body.signer_title, 120) },
    })
    return NextResponse.json({ ok: true })
  }

  // Edit the details of one still waiting to be signed.
  const patch: Record<string, any> = { updated_at: now }
  if ('approver_role' in body) patch.approver_role = clean(body.approver_role, 80) || 'Department Manager'
  if ('approver_name' in body) patch.approver_name = clean(body.approver_name, 120)
  if ('approver_email' in body) patch.approver_email = clean(body.approver_email, 200)
  if ('buyer_reference' in body) patch.buyer_reference = clean(body.buyer_reference, 80)
  if ('notes' in body) patch.notes = clean(body.notes, 1000)
  if (Array.isArray(body.signatory_ids)) {
    const ids = body.signatory_ids.filter((x: unknown) => typeof x === 'string')
    const { data: people } = ids.length
      ? await db.from('billing_signatories').select('*').in('id', ids).order('position')
      : { data: [] }
    const copies = signatureCopies(people || [], new Date())
    patch.supplier_signatures = copies.length ? copies : null
  }
  const { data, error } = await db.from('purchase_orders').update(patch).eq('id', po.id).select('*').maybeSingle()
  if (error) return NextResponse.json({ error: error.message || 'Could not save' }, { status: 500 })
  return NextResponse.json({ purchaseOrder: forScreen(data) })
}
