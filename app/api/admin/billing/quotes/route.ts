import { NextResponse } from 'next/server'
import { randomBytes } from 'node:crypto'
import { adminDb, migrationMissing } from '@/lib/admin-api'
import { requireQuoteAccess, type Actor } from '@/lib/rep-check'
import { FOUNDER_ADMIN_USER_ID } from '@/lib/admin-check'
import {
  documentTotals, effectiveVatRateBp, quoteValidUntil, lineTotalCents,
  fromSnapshot, toSnapshot, bankSnapshot, type DocLine,
} from '@/lib/billing-docs'
import { quoteDisplayStatus, isQuoteExpired } from '@/lib/billing-view'

// Quotes: draft, issue, accept, convert.
//
// Reachable by admins AND by sales reps, and reps see ONLY their own. Every
// query below is scoped with mine(), so a rep asking for a quote by id gets
// nothing back unless they raised it - there is no route in here that returns
// somebody else's pricing.
//
// Same one-way door as invoices - a draft has no number and is editable, an
// issued quote is frozen and snapshotted - with one addition that matters more
// here than anywhere else: issuing mints the public token. A quote exists to be
// sent to somebody, and a quote that has been signed has to prove WHAT was
// signed, which only works if the document could not change afterwards.

export const runtime = 'nodejs'

type LineIn = { description?: string; qty?: number | string; unit_price_cents?: number | string }

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

/** 32 hex characters from a CSPRNG. The only thing standing between a stranger
 *  and a client's pricing, so not Math.random and not the row id. */
const mintToken = () => randomBytes(16).toString('hex')

/** The user ids that count as staff. Cached per request, not per process: a
 *  new admin should not have to wait for a deploy to have their quotes seen. */
async function staffIds(db: any): Promise<string[]> {
  const { data } = await db.from('profiles').select('user_id').eq('is_admin', true)
  return [...new Set([FOUNDER_ADMIN_USER_ID, ...(data || []).map((p: any) => p.user_id)])]
}

/**
 * Narrow a quotes query to what this actor may see.
 *
 * An admin sees everything. A rep sees the quotes THEY raised, plus any raised
 * by staff - which is the shape that is correct now and stays correct later.
 * With one rep that is every quote on the system, which is what was asked for;
 * when a second rep arrives they are already walled off from each other with
 * nobody having to remember to change anything. A permission that has to be
 * narrowed later is a permission that does not get narrowed.
 *
 * Enforced in the query rather than the interface, because a UI filter is a
 * suggestion and a query filter is a rule.
 */
function mine(q: any, actor: Actor, staff: string[]) {
  if (actor.isAdmin) return q
  return q.in('created_by', [...new Set([actor.userId, ...staff])])
}

export async function GET(request: Request) {
  const gate = await requireQuoteAccess()
  if ('error' in gate) return gate.error
  const actor = gate.actor

  const url = new URL(request.url)
  const id = url.searchParams.get('id')
  const status = url.searchParams.get('status')
  const db = adminDb()

  if (id) {
    const { data: quote, error } = await mine(
      db.from('quotes').select('*').eq('id', id), actor, await staffIds(db)).maybeSingle()
    if (error || !quote) return NextResponse.json({ error: 'No such quote' }, { status: 404 })
    const { data: lines } = await db
      .from('quote_lines').select('*').eq('quote_id', id).order('position')
    return NextResponse.json({
      quote: { ...quote, display_status: quoteDisplayStatus(quote) },
      lines: lines || [],
    })
  }

  let q = mine(db.from('quotes').select('*'), actor, await staffIds(db))
    .order('created_at', { ascending: false }).limit(300)
  if (status && status !== 'all') {
    q = status === 'open' ? q.in('status', ['draft', 'issued', 'sent']) : q.eq('status', status)
  }
  const { data, error } = await q
  if (error) return migrationMissing('Quotes')

  const { data: clients } = await db.from('billing_clients').select('id, name')
  const byId = Object.fromEntries((clients || []).map((c: any) => [c.id, c.name]))

  return NextResponse.json({
    quotes: (data || []).map((qt: any) => ({
      ...qt,
      client_name: byId[qt.client_id] || 'Unknown client',
      display_status: quoteDisplayStatus(qt),
    })),
  })
}

export async function POST(request: Request) {
  const gate = await requireQuoteAccess()
  if ('error' in gate) return gate.error
  const actor = gate.actor

  const body = await request.json().catch(() => ({}))
  if (!body?.client_id) return NextResponse.json({ error: 'A quote needs a client.' }, { status: 400 })

  const db = adminDb()
  const { data: settings, error: sErr } = await db
    .from('billing_settings').select('*').eq('id', true).maybeSingle()
  if (sErr) return migrationMissing()

  const lines = normaliseLines(body.lines)
  const totals = documentTotals(lines, effectiveVatRateBp(settings?.vat_number, settings?.vat_rate_bp))

  const { data: quote, error } = await db.from('quotes').insert({
    client_id: body.client_id,
    status: 'draft',
    currency: 'ZAR',
    subtotal_cents: totals.subtotalCents,
    vat_rate_bp: totals.vatRateBp,
    vat_cents: totals.vatCents,
    total_cents: totals.totalCents,
    notes: typeof body.notes === 'string' ? body.notes.trim() || null : null,
    created_by: actor.userId,
  }).select('*').maybeSingle()
  if (error) return NextResponse.json({ error: error.message || 'Could not create the draft' }, { status: 500 })

  if (lines.length) {
    await db.from('quote_lines').insert(lines.map((l, position) => ({
      quote_id: quote.id, position,
      description: l.description, qty: l.qty,
      unit_price_cents: l.unitPriceCents, line_total_cents: lineTotalCents(l),
    })))
  }
  await db.from('document_events').insert({
    doc_type: 'quote', doc_id: quote.id, event: 'created', actor: actor.userId,
  })

  return NextResponse.json({ quote })
}

export async function PATCH(request: Request) {
  const gate = await requireQuoteAccess()
  if ('error' in gate) return gate.error
  const actor = gate.actor

  const body = await request.json().catch(() => ({}))
  if (!body?.id) return NextResponse.json({ error: 'Which quote?' }, { status: 400 })

  const db = adminDb()
  const { data: quote, error: qErr } = await mine(
    db.from('quotes').select('*').eq('id', body.id), actor, await staffIds(db)).maybeSingle()
  if (qErr || !quote) return NextResponse.json({ error: 'No such quote' }, { status: 404 })

  if (body.action === 'issue') return issue(db, quote, actor.userId)
  if (body.action === 'convert') {
    // Turning a quote into an invoice is billing, not selling. A rep raises
    // the quote and somebody in accounts raises the bill.
    if (!actor.isAdmin) {
      return NextResponse.json({
        error: 'Only Cardtly staff can turn a quote into an invoice. Let them know it has been accepted.',
      }, { status: 403 })
    }
    return convert(db, quote, actor.userId)
  }
  if (body.action === 'cancel') {
    await db.from('quotes').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', quote.id)
    await db.from('document_events').insert({ doc_type: 'quote', doc_id: quote.id, event: 'cancelled', actor: actor.userId })
    return NextResponse.json({ ok: true })
  }

  // Editable until somebody has made a decision against a specific version.
  //
  // A signed quote is evidence of what was agreed, so accepted and declined are
  // frozen outright - editing one would falsify a signature. Issued and sent
  // are not decisions, they are a document in flight, and "take line three out"
  // is the most ordinary thing a client says.
  const LOCKED: Record<string, string> = {
    accepted: `Quote ${quote.number} has been signed by the client. Its lines are the record of what they agreed to, so it cannot be changed. Raise a new quote for the revised work.`,
    declined: `Quote ${quote.number} was declined. Raise a new one rather than editing this.`,
    cancelled: `Quote ${quote.number} is cancelled.`,
  }
  if (LOCKED[quote.status]) {
    return NextResponse.json({ error: LOCKED[quote.status] }, { status: 409 })
  }

  const { data: settings } = await db.from('billing_settings').select('*').eq('id', true).maybeSingle()
  const patch: Record<string, any> = { updated_at: new Date().toISOString() }
  if (body.client_id) patch.client_id = body.client_id
  if ('notes' in body) patch.notes = typeof body.notes === 'string' ? body.notes.trim() || null : null

  if (Array.isArray(body.lines)) {
    const lines = normaliseLines(body.lines)
    const totals = documentTotals(lines, effectiveVatRateBp(settings?.vat_number, settings?.vat_rate_bp))
    patch.subtotal_cents = totals.subtotalCents
    patch.vat_rate_bp = totals.vatRateBp
    patch.vat_cents = totals.vatCents
    patch.total_cents = totals.totalCents

    await db.from('quote_lines').delete().eq('quote_id', quote.id)
    if (lines.length) {
      await db.from('quote_lines').insert(lines.map((l, position) => ({
        quote_id: quote.id, position,
        description: l.description, qty: l.qty,
        unit_price_cents: l.unitPriceCents, line_total_cents: lineTotalCents(l),
      })))
    }
  }

  // Only after issue. A draft has no revisions worth counting because nobody
  // outside has seen it.
  const revised = quote.status !== 'draft'
  if (revised) patch.revision = (Number(quote.revision) || 1) + 1

  const { data, error } = await db.from('quotes').update(patch).eq('id', quote.id).select('*').maybeSingle()
  if (error) {
    if (/column .* revision .* does not exist/i.test(error.message || '')) {
      return migrationMissing('Editing an issued quote')
    }
    return NextResponse.json({ error: error.message || 'Could not save' }, { status: 500 })
  }

  if (revised) {
    await db.from('document_events').insert({
      doc_type: 'quote', doc_id: quote.id, event: 'revised', actor: actor.userId,
      meta: {
        revision: data.revision,
        from_total_cents: quote.total_cents,
        to_total_cents: data.total_cents,
      },
    })
  }

  return NextResponse.json({ quote: data, revised })
}

async function issue(db: any, quote: any, actor: string) {
  if (quote.status !== 'draft') {
    return NextResponse.json({ error: `Quote ${quote.number} is already issued.` }, { status: 409 })
  }
  const { count } = await db
    .from('quote_lines').select('id', { count: 'exact', head: true }).eq('quote_id', quote.id)
  if (!count) return NextResponse.json({ error: 'A quote with no lines cannot be issued.' }, { status: 400 })

  const { data: settings } = await db.from('billing_settings').select('*').eq('id', true).maybeSingle()
  const { data: client } = await db.from('billing_clients').select('*').eq('id', quote.client_id).maybeSingle()
  if (!client) return NextResponse.json({ error: 'This quote has no client.' }, { status: 400 })

  const { data: terms } = await db
    .from('billing_terms').select('id, body').eq('is_active', true).limit(1)

  const { data: number, error: nErr } = await db.rpc('next_document_number', { p_doc_type: 'quote' })
  if (nErr || !number) return NextResponse.json({ error: 'Could not allocate a quote number.' }, { status: 500 })

  const issuedAt = new Date()
  const { data, error } = await db.from('quotes').update({
    number,
    status: 'issued',
    issued_at: issuedAt.toISOString(),
    valid_until: quoteValidUntil(issuedAt, Number(settings?.quote_valid_days ?? 14)),
    from_snapshot: fromSnapshot(settings || {}),
    to_snapshot: toSnapshot(client),
    bank_snapshot: bankSnapshot(settings || {}),
    terms_id: terms?.[0]?.id || null,
    // Snapshotted, not joined. A signed quote has to be able to show WHICH
    // terms were agreed to, and editing the active terms next year must not
    // change what this client accepted.
    terms_snapshot: terms?.[0]?.body || null,
    public_token: quote.public_token || mintToken(),
    updated_at: issuedAt.toISOString(),
  }).eq('id', quote.id).select('*').maybeSingle()

  if (error) return NextResponse.json({ error: error.message || 'Could not issue' }, { status: 500 })

  if (!terms?.[0]?.body) {
    // Not fatal, but the client is being asked to accept something with no
    // terms attached, and that is worth saying out loud rather than shipping
    // quietly.
    await db.from('document_events').insert({
      doc_type: 'quote', doc_id: quote.id, event: 'issued_without_terms', actor,
    })
  }
  await db.from('document_events').insert({
    doc_type: 'quote', doc_id: quote.id, event: 'issued', actor,
    meta: { number, valid_until: data.valid_until, total_cents: quote.total_cents },
  })

  return NextResponse.json({ quote: data, warning: terms?.[0]?.body ? null : 'No terms are saved, so this quote goes out without any. Add them under Accounting, Settings.' })
}

/**
 * Quote to invoice.
 *
 * Produces a DRAFT invoice, not an issued one. Accepting a quote and raising
 * the bill are two decisions, and the second one often needs a change first -
 * a deposit, a different date, a line the client asked to split. Issuing behind
 * somebody's back would hand them a frozen document they never read.
 */
async function convert(db: any, quote: any, actor: string) {
  if (quote.status === 'draft') {
    return NextResponse.json({ error: 'Issue the quote before turning it into an invoice.' }, { status: 409 })
  }
  const { data: existing } = await db
    .from('invoices').select('id, number').eq('from_quote_id', quote.id).limit(1)
  if (existing?.length) {
    return NextResponse.json({
      error: `This quote has already become invoice ${existing[0].number || '(a draft)'}.`,
      invoice_id: existing[0].id,
    }, { status: 409 })
  }

  const { data: lines } = await db
    .from('quote_lines').select('*').eq('quote_id', quote.id).order('position')

  const { data: invoice, error } = await db.from('invoices').insert({
    client_id: quote.client_id,
    from_quote_id: quote.id,
    status: 'draft',
    currency: quote.currency || 'ZAR',
    subtotal_cents: quote.subtotal_cents,
    vat_rate_bp: quote.vat_rate_bp,
    vat_cents: quote.vat_cents,
    total_cents: quote.total_cents,
    notes: quote.notes,
    created_by: actor,
  }).select('*').maybeSingle()
  if (error) return NextResponse.json({ error: error.message || 'Could not create the invoice' }, { status: 500 })

  if (lines?.length) {
    await db.from('invoice_lines').insert(lines.map((l: any, position: number) => ({
      invoice_id: invoice.id, position,
      description: l.description, qty: l.qty,
      unit_price_cents: l.unit_price_cents, line_total_cents: l.line_total_cents,
    })))
  }

  await db.from('document_events').insert([
    { doc_type: 'quote', doc_id: quote.id, event: 'converted', actor, meta: { invoice_id: invoice.id } },
    { doc_type: 'invoice', doc_id: invoice.id, event: 'created_from_quote', actor, meta: { quote_id: quote.id, quote_number: quote.number } },
  ])

  return NextResponse.json({ invoice, expired: isQuoteExpired(quote) })
}
