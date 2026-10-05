import { NextResponse } from 'next/server'
import { requireAdmin, adminDb, migrationMissing } from '@/lib/admin-api'
import { applyPrepaidPeriod } from '@/lib/prepaid'
import {
  documentTotals, effectiveVatRateBp, defaultDueDate, invoiceOutstanding,
  fromSnapshot, toSnapshot, bankSnapshot, lineTotalCents,
  recipientChanges, signatureCopies,
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

/**
 * An invoice as the screen needs it: who signed, without the images.
 *
 * A signature copy is a PNG of tens of kilobytes, and the list returns up to
 * 300 invoices. Only the PDF needs the pictures; the screen needs the names.
 */
function forScreen(i: any) {
  const { signatures, ...rest } = i || {}
  return {
    ...rest,
    signed_by: Array.isArray(signatures)
      ? signatures.map((x: any) => ({ name: x?.name, title: x?.title || null, signedAt: x?.signedAt || null }))
      : [],
  }
}

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
    return NextResponse.json({ invoice: forScreen(invoice), lines: lines || [], payments: payments || [] })
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

  // Credits reduce what is owed without being payments. An invoice showing the
  // full amount after it has been credited is one somebody chases for money
  // that is not due.
  const ids = (data || []).map((i: any) => i.id)
  const { data: credits } = ids.length
    ? await db.from('credit_notes').select('invoice_id, total_cents')
        .in('invoice_id', ids).eq('status', 'issued')
    : { data: [] }
  const creditedBy: Record<string, number> = {}
  for (const c of credits || []) {
    creditedBy[c.invoice_id] = (creditedBy[c.invoice_id] || 0) + (c.total_cents || 0)
  }

  return NextResponse.json({
    invoices: (data || []).map((i: any) => ({
      ...forScreen(i),
      client_name: byId[i.client_id] || 'Unknown client',
      credited_cents: creditedBy[i.id] || 0,
      outstanding_cents: invoiceOutstanding(i.total_cents || 0, i.paid_cents || 0, creditedBy[i.id] || 0),
    })),
  })
}

/** Create a draft. */
/**
 * The prepaid period from a request body, checked.
 *
 * Absent means "not mentioned, leave it". null, '' or 0 clears it. Anything
 * else must be 1 to 120 whole months, and only for a client linked to a team:
 * a period with no team behind it would be paid for and switch nothing on.
 */
async function prepaidMonthsFrom(db: any, body: any, clientId: string): Promise<{ value?: number | null; error?: NextResponse }> {
  if (!body || !('prepaid_months' in body)) return {}
  const raw = body.prepaid_months
  if (raw === null || raw === '' || raw === 0 || raw === '0') return { value: null }
  const n = Math.floor(Number(raw))
  if (!Number.isFinite(n) || n < 1 || n > 120) {
    return { error: NextResponse.json({ error: 'A prepaid period is 1 to 120 months.' }, { status: 400 }) }
  }
  const { data: client } = await db
    .from('billing_clients').select('organization_id').eq('id', clientId).maybeSingle()
  if (!client?.organization_id) {
    return {
      error: NextResponse.json({
        error: 'This client is not linked to a team, so a prepaid period would switch nothing on. Link the client to its team under Clients first.',
      }, { status: 400 }),
    }
  }
  return { value: n }
}

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

  const prepaid = await prepaidMonthsFrom(db, body, body.client_id)
  if (prepaid.error) return prepaid.error

  const { data: invoice, error } = await db.from('invoices').insert({
    // Only when given, so a draft without one still saves before migration 091.
    ...(prepaid.value !== undefined ? { prepaid_months: prepaid.value } : {}),
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

  // The prepaid period is not printed on the invoice, so unlike the lines it
  // may be set after issuing: the invoice goes out, and before it is paid the
  // period that payment buys can still be recorded or corrected. Never once
  // it has been applied - that period is already on the team.
  if (body.action === 'set_prepaid') {
    if (['cancelled', 'written_off', 'credited'].includes(invoice.status)) {
      return NextResponse.json({ error: `This invoice is ${invoice.status.replace('_', ' ')}, so it cannot switch a team on.` }, { status: 409 })
    }
    if (invoice.prepaid_applied_at) {
      return NextResponse.json({
        error: `The prepaid period on this invoice was already added to the team on ${String(invoice.prepaid_applied_at).slice(0, 10)}. Change the team's paid-until date under Teams instead.`,
      }, { status: 409 })
    }
    const prepaid = await prepaidMonthsFrom(db, { prepaid_months: body.prepaid_months ?? null }, invoice.client_id)
    if (prepaid.error) return prepaid.error
    const { error: setErr } = await db
      .from('invoices').update({ prepaid_months: prepaid.value ?? null, updated_at: new Date().toISOString() }).eq('id', invoice.id)
    if (setErr) return NextResponse.json({ error: setErr.message || 'Could not save the prepaid period' }, { status: 500 })
    await db.from('document_events').insert({
      doc_type: 'invoice', doc_id: invoice.id, event: 'prepaid_set', actor: gate.user.id,
      meta: { prepaid_months: prepaid.value ?? null },
    })
    // Already paid: apply it now rather than waiting for a payment that has
    // already happened.
    const result = invoice.status === 'paid' && prepaid.value ? await applyPrepaidPeriod(db, invoice.id) : null
    return NextResponse.json({ ok: true, prepaid_months: prepaid.value ?? null, applied: result })
  }
  // CORRECT WHO IT IS ADDRESSED TO. An issued invoice keeps a copy of the
  // client as they were when it was issued, so fixing a client's registered
  // name, address or VAT number changes nothing already sent - and their
  // accounts department will not pay an invoice made out wrongly. This copies
  // the client's current details onto the invoice and nothing else: same
  // number, same lines, same money. It goes through refresh_invoice_recipient
  // (migration 092), the one door the database leaves open for it, which also
  // records the old and new details in the invoice's history.
  if (body.action === 'refresh_client') {
    if (invoice.status === 'draft') {
      return NextResponse.json({ error: 'A draft already shows the client as they are now.' }, { status: 409 })
    }
    if (invoice.status === 'cancelled') {
      return NextResponse.json({ error: `Invoice ${invoice.number} is cancelled.` }, { status: 409 })
    }
    const { data: client } = await db.from('billing_clients').select('*').eq('id', invoice.client_id).maybeSingle()
    if (!client) return NextResponse.json({ error: 'This invoice has no client to copy from.' }, { status: 400 })
    const changed = recipientChanges(invoice.to_snapshot, client)
    if (!changed.length) {
      return NextResponse.json({ ok: true, changed: [], message: `${invoice.number} already shows the client's current details.` })
    }
    const { error: rErr } = await db.rpc('refresh_invoice_recipient', {
      p_invoice_id: invoice.id, p_to: toSnapshot(client), p_actor: gate.user.id,
    })
    if (rErr) {
      return NextResponse.json({
        error: /refresh_invoice_recipient/.test(rErr.message || '')
          ? 'Migration 092 has not been run yet, so issued invoices cannot be corrected.'
          : rErr.message || 'Could not update the invoice',
      }, { status: 500 })
    }
    return NextResponse.json({ ok: true, changed })
  }

  // SIGN IT. Copies of the chosen signatures go onto the invoice, so replacing
  // a signature later does not alter what this one shows. Not one of the
  // frozen fields, so an invoice already issued can be signed (or unsigned).
  if (body.action === 'sign') {
    if (invoice.status === 'cancelled') {
      return NextResponse.json({ error: `Invoice ${invoice.number} is cancelled.` }, { status: 409 })
    }
    const ids: string[] = Array.isArray(body.signatory_ids) ? body.signatory_ids.filter((x: unknown) => typeof x === 'string') : []
    let copies: ReturnType<typeof signatureCopies> = []
    if (ids.length) {
      const { data: people, error: pErr } = await db.from('billing_signatories').select('*').in('id', ids).order('position')
      if (pErr) return migrationMissing('Signatures')
      copies = signatureCopies(people || [], new Date())
    }
    const { error: sErr } = await db.from('invoices')
      .update({ signatures: copies.length ? copies : null, updated_at: new Date().toISOString() }).eq('id', invoice.id)
    if (sErr) return NextResponse.json({ error: sErr.message || 'Could not sign it' }, { status: 500 })
    await db.from('document_events').insert({
      doc_type: 'invoice', doc_id: invoice.id, event: copies.length ? 'signed' : 'unsigned', actor: gate.user.id,
      meta: { by: copies.map(c => c.name) },
    })
    return NextResponse.json({ ok: true, signatures: copies.map(c => ({ name: c.name, title: c.title, signedAt: c.signedAt })) })
  }

  // THE ORDER NUMBER it is raised against, printed on the invoice. Often only
  // arrives after the invoice has gone out, so it may be set at any time.
  if (body.action === 'set_po_number') {
    const po = typeof body.po_number === 'string' ? body.po_number.trim().slice(0, 80) || null : null
    const { error: pErr } = await db.from('invoices')
      .update({ po_number: po, updated_at: new Date().toISOString() }).eq('id', invoice.id)
    if (pErr) return NextResponse.json({ error: pErr.message || 'Could not save the order number' }, { status: 500 })
    await db.from('document_events').insert({
      doc_type: 'invoice', doc_id: invoice.id, event: 'po_number_set', actor: gate.user.id, meta: { po_number: po },
    })
    return NextResponse.json({ ok: true, po_number: po })
  }

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
  {
    const prepaid = await prepaidMonthsFrom(db, body, body.client_id || invoice.client_id)
    if (prepaid.error) return prepaid.error
    if (prepaid.value !== undefined) patch.prepaid_months = prepaid.value
  }

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

  // Signed by whoever signs invoices by default, unless somebody already chose
  // who signs this one. Read tolerantly: before migration 092 there is no
  // signatories table, and issuing must not fail over a signature.
  let signatures: ReturnType<typeof signatureCopies> | null = null
  if (!Array.isArray(invoice.signatures) || !invoice.signatures.length) {
    try {
      const { data: people, error: pErr } = await db
        .from('billing_signatories').select('*').eq('sign_invoices', true).order('position')
      if (!pErr && people?.length) {
        const copies = signatureCopies(people, issuedAt)
        if (copies.length) signatures = copies
      }
    } catch { /* unsigned is better than unissued */ }
  }

  const { data, error } = await db.from('invoices').update({
    ...(signatures ? { signatures } : {}),
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
