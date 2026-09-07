import { NextResponse } from 'next/server'
import { requireAdmin, adminDb, migrationMissing } from '@/lib/admin-api'
import {
  documentTotals, effectiveVatRateBp, defaultDueDate,
  fromSnapshot, toSnapshot, bankSnapshot, lineTotalCents,
  type DueRule, type DocLine,
} from '@/lib/billing-docs'

// Invoices: draft, edit, issue.
//
// A DRAFT has no number, is freely editable, and does not exist as far as
// anybody outside is concerned. ISSUING allocates the number, freezes the
// document and snapshots who sent it, who it went to, the banking details and
// the terms. After that the only lawful correction is a credit note.
//
// That is what makes "let us edit it before we approve" and "an invoice must
// never change after it is sent" both true at the same time. The database
// enforces the second half too - see the triggers in migration 064 - because a
// guard living only in this file is a guard the next route will not have.

export const runtime = 'nodejs'

type LineIn = { description?: string; qty?: number | string; unit_price_cents?: number | string }

/** Lines as the client sent them, cleaned and priced. Rounding happens once,
 *  in lineTotalCents, so a stored line always matches what gets printed. */
function normaliseLines(raw: unknown): DocLine[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((l: LineIn) => ({
      description: String(l?.description ?? '').trim(),
      qty: Number(l?.qty ?? 0),
      unitPriceCents: Math.round(Number(l?.unit_price_cents ?? 0)),
    }))
    .filter(l => l.description && Number.isFinite(l.qty) && Number.isFinite(l.unitPriceCents))
}

export async function GET(request: Request) {
  const gate = await requireAdmin()
  if ('error' in gate) return gate.error

  const url = new URL(request.url)
  const id = url.searchParams.get('id')
  const status = url.searchParams.get('status')
  const clientId = url.searchParams.get('client_id')
  const db = adminDb()

  if (id) {
    const { data: invoice, error } = await db.from('invoices').select('*').eq('id', id).maybeSingle()
    if (error || !invoice) return NextResponse.json({ error: 'No such invoice' }, { status: 404 })
    const { data: lines } = await db
      .from('invoice_lines').select('*').eq('invoice_id', id).order('position')
    const { data: payments } = await db
      .from('billing_payments').select('*').eq('invoice_id', id).order('paid_on')
    return NextResponse.json({ invoice, lines: lines || [], payments: payments || [] })
  }

  let q = db.from('invoices').select('*').order('created_at', { ascending: false }).limit(300)
  if (status && status !== 'all') {
    q = status === 'open'
      ? q.in('status', ['issued', 'sent', 'part_paid', 'overdue'])
      : q.eq('status', status)
  }
  if (clientId) q = q.eq('client_id', clientId)

  const { data, error } = await q
  if (error) return migrationMissing('Invoices')

  const { data: clients } = await db.from('billing_clients').select('id, name')
  const byId = Object.fromEntries((clients || []).map((c: any) => [c.id, c.name]))

  return NextResponse.json({
    invoices: (data || []).map((i: any) => ({
      ...i,
      client_name: byId[i.client_id] || 'Unknown client',
      outstanding_cents: Math.max(0, (i.total_cents || 0) - (i.paid_cents || 0)),
    })),
  })
}

/** Create a draft. */
export async function POST(request: Request) {
  const gate = await requireAdmin()
  if ('error' in gate) return gate.error

  const body = await request.json().catch(() => ({}))
  if (!body?.client_id) return NextResponse.json({ error: 'An invoice needs a client.' }, { status: 400 })

  const db = adminDb()
  const { data: settings, error: sErr } = await db
    .from('billing_settings').select('*').eq('id', true).maybeSingle()
  if (sErr) return migrationMissing()

  const lines = normaliseLines(body.lines)
  // Not settings.vat_rate_bp: until there is a VAT number the rate is zero,
  // whatever settings says.
  const vatRateBp = effectiveVatRateBp(settings?.vat_number, settings?.vat_rate_bp)
  const totals = documentTotals(lines, vatRateBp)

  const { data: invoice, error } = await db.from('invoices').insert({
    client_id: body.client_id,
    status: 'draft',
    currency: 'ZAR',
    subtotal_cents: totals.subtotalCents,
    vat_rate_bp: totals.vatRateBp,
    vat_cents: totals.vatCents,
    total_cents: totals.totalCents,
    notes: typeof body.notes === 'string' ? body.notes.trim() || null : null,
    created_by: gate.user.id,
  }).select('*').maybeSingle()
  if (error) return NextResponse.json({ error: error.message || 'Could not create the draft' }, { status: 500 })

  if (lines.length) {
    await db.from('invoice_lines').insert(lines.map((l, position) => ({
      invoice_id: invoice.id, position,
      description: l.description, qty: l.qty,
      unit_price_cents: l.unitPriceCents,
      line_total_cents: lineTotalCents(l),
    })))
  }

  await db.from('document_events').insert({
    doc_type: 'invoice', doc_id: invoice.id, event: 'created', actor: gate.user.id,
  })

  return NextResponse.json({ invoice })
}

/** Edit a draft, or issue it. */
export async function PATCH(request: Request) {
  const gate = await requireAdmin()
  if ('error' in gate) return gate.error

  const body = await request.json().catch(() => ({}))
  if (!body?.id) return NextResponse.json({ error: 'Which invoice?' }, { status: 400 })

  const db = adminDb()
  const { data: invoice, error: iErr } = await db
    .from('invoices').select('*').eq('id', body.id).maybeSingle()
  if (iErr || !invoice) return NextResponse.json({ error: 'No such invoice' }, { status: 404 })

  if (body.action === 'issue') return issue(db, invoice, gate.user.id)
  if (body.action === 'cancel') {
    if (invoice.paid_cents > 0) {
      return NextResponse.json({
        error: 'This invoice has payments against it. Raise a credit note rather than cancelling it.',
      }, { status: 409 })
    }
    await db.from('invoices').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', invoice.id)
    await db.from('document_events').insert({ doc_type: 'invoice', doc_id: invoice.id, event: 'cancelled', actor: gate.user.id })
    return NextResponse.json({ ok: true })
  }

  if (invoice.status !== 'draft') {
    return NextResponse.json({
      error: `Invoice ${invoice.number} has been issued and cannot be edited. Raise a credit note instead.`,
    }, { status: 409 })
  }

  const { data: settings } = await db.from('billing_settings').select('*').eq('id', true).maybeSingle()
  const patch: Record<string, any> = { updated_at: new Date().toISOString() }
  if (body.client_id) patch.client_id = body.client_id
  if ('notes' in body) patch.notes = typeof body.notes === 'string' ? body.notes.trim() || null : null

  if (Array.isArray(body.lines)) {
    const lines = normaliseLines(body.lines)
    const vatRateBp = effectiveVatRateBp(settings?.vat_number, settings?.vat_rate_bp)
    const totals = documentTotals(lines, vatRateBp)
    patch.subtotal_cents = totals.subtotalCents
    patch.vat_rate_bp = totals.vatRateBp
    patch.vat_cents = totals.vatCents
    patch.total_cents = totals.totalCents

    // Replaced wholesale rather than diffed. A draft's lines have no identity
    // worth preserving, and a diff is where an off-by-one silently drops one.
    await db.from('invoice_lines').delete().eq('invoice_id', invoice.id)
    if (lines.length) {
      await db.from('invoice_lines').insert(lines.map((l, position) => ({
        invoice_id: invoice.id, position,
        description: l.description, qty: l.qty,
        unit_price_cents: l.unitPriceCents,
        line_total_cents: lineTotalCents(l),
      })))
    }
  }

  const { data, error } = await db
    .from('invoices').update(patch).eq('id', invoice.id).select('*').maybeSingle()
  if (error) return NextResponse.json({ error: error.message || 'Could not save' }, { status: 500 })
  return NextResponse.json({ invoice: data })
}

/**
 * The one-way door.
 *
 * Everything the document will ever need is copied onto it here. After this it
 * renders identically forever, even after the bank details change and the
 * address moves.
 */
async function issue(db: any, invoice: any, actor: string) {
  if (invoice.status !== 'draft') {
    return NextResponse.json({ error: `Invoice ${invoice.number} is already issued.` }, { status: 409 })
  }

  const { count } = await db
    .from('invoice_lines').select('id', { count: 'exact', head: true }).eq('invoice_id', invoice.id)
  if (!count) {
    return NextResponse.json({ error: 'An invoice with no lines cannot be issued.' }, { status: 400 })
  }

  const { data: settings } = await db.from('billing_settings').select('*').eq('id', true).maybeSingle()
  const { data: client } = await db.from('billing_clients').select('*').eq('id', invoice.client_id).maybeSingle()
  if (!client) return NextResponse.json({ error: 'This invoice has no client.' }, { status: 400 })

  const { data: terms } = await db
    .from('billing_terms').select('id, body').eq('is_active', true).limit(1)

  const { data: number, error: nErr } = await db.rpc('next_document_number', { p_doc_type: 'invoice' })
  if (nErr || !number) {
    return NextResponse.json({ error: 'Could not allocate an invoice number.' }, { status: 500 })
  }

  const issuedAt = new Date()
  const rule = (settings?.invoice_due_rule as DueRule) || 'end_of_month'
  const dueAt = defaultDueDate(rule, issuedAt, Number(settings?.payment_terms_days ?? 14))

  const { data, error } = await db.from('invoices').update({
    number,
    status: 'issued',
    issued_at: issuedAt.toISOString(),
    due_at: dueAt,
    from_snapshot: fromSnapshot(settings || {}),
    to_snapshot: toSnapshot(client),
    bank_snapshot: bankSnapshot(settings || {}),
    terms_id: terms?.[0]?.id || null,
    terms_snapshot: terms?.[0]?.body || null,
    updated_at: issuedAt.toISOString(),
  }).eq('id', invoice.id).select('*').maybeSingle()

  if (error) return NextResponse.json({ error: error.message || 'Could not issue' }, { status: 500 })

  await db.from('document_events').insert({
    doc_type: 'invoice', doc_id: invoice.id, event: 'issued', actor,
    meta: { number, due_at: dueAt, total_cents: invoice.total_cents },
  })

  return NextResponse.json({ invoice: data })
}
