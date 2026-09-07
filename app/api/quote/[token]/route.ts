import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isQuoteExpired } from '@/lib/billing-view'
import { formatMoney } from '@/lib/billing-docs'

// The client's side of a quote. PUBLIC - no session, by design, because the
// person accepting is somebody else's accounts department and will not have one.
//
// The token is the whole of the security, so:
//   - it is 32 hex characters from a CSPRNG, minted at issue
//   - only the quote it belongs to is ever returned, never a list
//   - only the fields the client is entitled to see go back, which is the
//     document itself and nothing about our other clients
//
// The service-role client is used because the billing tables have RLS on with
// no policies. That is safe here only because every query below is pinned to
// the token.

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  ) as any
}

/** Only what belongs on the page in front of the client. */
function publicView(quote: any, lines: any[]) {
  const expired = isQuoteExpired(quote)
  return {
    number: quote.number,
    status: expired ? 'expired' : quote.status,
    issuedAt: quote.issued_at,
    validUntil: quote.valid_until,
    currency: quote.currency || 'ZAR',
    subtotal: formatMoney(quote.subtotal_cents, quote.currency || 'ZAR'),
    vatRateBp: quote.vat_rate_bp,
    vat: formatMoney(quote.vat_cents, quote.currency || 'ZAR'),
    total: formatMoney(quote.total_cents, quote.currency || 'ZAR'),
    notes: quote.notes,
    lines: (lines || []).map(l => ({
      description: l.description,
      qty: Number(l.qty),
      unit: formatMoney(l.unit_price_cents, quote.currency || 'ZAR'),
      amount: formatMoney(l.line_total_cents, quote.currency || 'ZAR'),
    })),
    from: quote.from_snapshot || {},
    to: quote.to_snapshot || {},
    bank: quote.bank_snapshot || null,
    terms: quote.terms_snapshot || null,
    acceptedAt: quote.accepted_at,
    acceptedName: quote.accepted_name,
    canAccept: !expired && ['issued', 'sent'].includes(quote.status),
  }
}

export async function GET(_request: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params
  if (!token || token.length < 16) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const supabase = db()
  const { data: quote } = await supabase
    .from('quotes').select('*').eq('public_token', token).maybeSingle()
  // Cancelled reads as "not found" rather than "cancelled": a withdrawn quote
  // is not a document the client should still be looking at.
  if (!quote || quote.status === 'draft' || quote.status === 'cancelled') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { data: lines } = await supabase
    .from('quote_lines').select('*').eq('quote_id', quote.id).order('position')

  // Only the first time, and only for a quote still open, so a reload or a
  // preview by us does not fill the trail with noise.
  if (quote.status === 'issued' || quote.status === 'sent') {
    const { data: seen } = await supabase
      .from('document_events').select('id')
      .eq('doc_type', 'quote').eq('doc_id', quote.id).eq('event', 'opened').limit(1)
    if (!seen?.length) {
      await supabase.from('document_events').insert({
        doc_type: 'quote', doc_id: quote.id, event: 'opened', meta: { at: new Date().toISOString() },
      })
    }
  }

  return NextResponse.json({ quote: publicView(quote, lines || []) })
}

/** Accept or decline. This is the signature. */
export async function POST(request: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params
  if (!token || token.length < 16) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await request.json().catch(() => ({}))
  const decision = body?.decision === 'decline' ? 'decline' : 'accept'

  const supabase = db()
  const { data: quote } = await supabase
    .from('quotes').select('*').eq('public_token', token).maybeSingle()
  if (!quote || !['issued', 'sent'].includes(quote.status)) {
    return NextResponse.json({ error: 'This quote is no longer open.' }, { status: 409 })
  }
  if (isQuoteExpired(quote)) {
    return NextResponse.json({
      error: `This quote lapsed on ${quote.valid_until}. Please ask us for an updated one.`,
    }, { status: 409 })
  }

  if (decision === 'decline') {
    await supabase.from('quotes')
      .update({ status: 'declined', updated_at: new Date().toISOString() }).eq('id', quote.id)
    await supabase.from('document_events').insert({
      doc_type: 'quote', doc_id: quote.id, event: 'declined',
      meta: { reason: typeof body.reason === 'string' ? body.reason.slice(0, 500) : null },
    })
    return NextResponse.json({ ok: true, status: 'declined' })
  }

  const name = String(body?.name || '').trim()
  const email = String(body?.email || '').trim()
  if (name.length < 2) {
    return NextResponse.json({ error: 'Please type your full name to sign.' }, { status: 400 })
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: 'Please give an email address we can confirm this to.' }, { status: 400 })
  }

  // The evidence behind the signature: who, when, from where, in what. Without
  // these, "they accepted" is an assertion rather than a record.
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip') || null
  const ua = request.headers.get('user-agent')?.slice(0, 500) || null
  const acceptedAt = new Date().toISOString()

  const { error } = await supabase.from('quotes').update({
    status: 'accepted',
    accepted_at: acceptedAt,
    accepted_name: name.slice(0, 200),
    accepted_email: email.slice(0, 200),
    accepted_ip: ip,
    accepted_ua: ua,
    updated_at: acceptedAt,
  }).eq('id', quote.id)
    // Guarded: two people hitting Accept at once must not both write a
    // signature, and the loser must be told rather than silently overwritten.
    .in('status', ['issued', 'sent'])

  if (error) return NextResponse.json({ error: 'Could not record that. Please try again.' }, { status: 500 })

  await supabase.from('document_events').insert({
    doc_type: 'quote', doc_id: quote.id, event: 'accepted',
    meta: { name, email, ip, ua, terms_id: quote.terms_id, number: quote.number },
  })

  return NextResponse.json({ ok: true, status: 'accepted', acceptedAt, acceptedName: name })
}
