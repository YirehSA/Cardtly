import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { formatMoney, isSignaturePng } from '@/lib/billing-docs'
import { FROM_EMAIL } from '@/lib/email'
import {
  renderPurchaseOrderSignedEmail, QUOTE_ACCEPTED_TO, QUOTE_ACCEPTED_CC,
} from '@/lib/billing-email-templates'

// The client's side of a purchase order: where their department manager
// approves it. PUBLIC - no session, by design, like the quote acceptance page:
// the person signing works for the client and has no Cardtly account.
//
// The token is the whole of the security, so, exactly as app/api/quote:
//   - it is 32 hex characters from a CSPRNG, minted when the order is raised
//   - only the order it belongs to is ever returned, never a list
//   - only what the signer needs goes back. Cardtly's signature IMAGES are
//     not among it: the page says who signed for Cardtly, and the pictures
//     stay inside the billing tables and the PDF.

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  ) as any
}

function publicView(po: any, lines: any[]) {
  const money = (c: number) => formatMoney(c, po.currency || 'ZAR')
  return {
    number: po.number,
    status: po.status,
    issuedAt: po.issued_at,
    reference: po.source_label || null,
    buyerReference: po.buyer_reference || null,
    subtotal: money(po.subtotal_cents),
    vatRateBp: po.vat_rate_bp,
    vat: money(po.vat_cents),
    total: money(po.total_cents),
    notes: po.notes,
    lines: (lines || []).map(l => ({
      description: l.description,
      qty: Number(l.qty),
      unit: money(l.unit_price_cents),
      amount: money(l.line_total_cents),
    })),
    supplier: po.supplier_snapshot || {},
    buyer: po.buyer_snapshot || {},
    supplierSignedBy: Array.isArray(po.supplier_signatures)
      ? po.supplier_signatures.map((x: any) => ({ name: x?.name, title: x?.title || null })).filter((x: any) => x.name)
      : [],
    approverRole: po.approver_role || 'Department Manager',
    approverName: po.approver_name || null,
    signedAt: po.signed_at,
    signerName: po.signer_name,
    signerTitle: po.signer_title,
    canSign: po.status === 'awaiting_signature',
  }
}

const validToken = (t: string | undefined) => !!t && /^[a-f0-9]{32}$/.test(t)

export async function GET(_request: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params
  if (!validToken(token)) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const supabase = db()
  const { data: po } = await supabase
    .from('purchase_orders').select('*').eq('public_token', token).maybeSingle()
  // Cancelled reads as not found: a withdrawn order is not one to sign.
  if (!po || po.status === 'cancelled') return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: lines } = await supabase
    .from('purchase_order_lines').select('*').eq('purchase_order_id', po.id).order('position')

  if (po.status === 'awaiting_signature') {
    const { data: seen } = await supabase
      .from('document_events').select('id')
      .eq('doc_type', 'purchase_order').eq('doc_id', po.id).eq('event', 'opened').limit(1)
    if (!seen?.length) {
      await supabase.from('document_events').insert({
        doc_type: 'purchase_order', doc_id: po.id, event: 'opened', meta: { at: new Date().toISOString() },
      })
    }
  }

  return NextResponse.json({ purchaseOrder: publicView(po, lines || []) })
}

/** Approve it. The drawn signature, the typed name and the evidence. */
export async function POST(request: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params
  if (!validToken(token)) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await request.json().catch(() => ({}))
  const supabase = db()
  const { data: po } = await supabase
    .from('purchase_orders').select('*').eq('public_token', token).maybeSingle()
  if (!po || po.status !== 'awaiting_signature') {
    return NextResponse.json({ error: 'This purchase order is no longer waiting for a signature.' }, { status: 409 })
  }

  const name = String(body?.name || '').trim()
  const title = String(body?.title || '').trim()
  const email = String(body?.email || '').trim()
  if (name.length < 2) return NextResponse.json({ error: 'Please type your full name.' }, { status: 400 })
  if (title.length < 2) return NextResponse.json({ error: 'Please give your position.' }, { status: 400 })
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: 'Please give an email address we can confirm this to.' }, { status: 400 })
  }
  if (body?.authorised !== true) {
    return NextResponse.json({ error: 'Please confirm you are authorised to approve this purchase.' }, { status: 400 })
  }
  if (!isSignaturePng(body?.signature)) {
    return NextResponse.json({ error: 'Please sign in the box.' }, { status: 400 })
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip') || null
  const ua = request.headers.get('user-agent')?.slice(0, 500) || null
  const signedAt = new Date().toISOString()

  const { data: updated, error } = await supabase.from('purchase_orders').update({
    status: 'signed',
    signer_name: name.slice(0, 120),
    signer_title: title.slice(0, 120),
    signer_email: email.slice(0, 200),
    signature_png: body.signature,
    signed_at: signedAt,
    signed_ip: ip,
    signed_ua: ua,
    signed_via: 'link',
    updated_at: signedAt,
  }).eq('id', po.id)
    // Two people pressing Sign at once must not both write a signature.
    .eq('status', 'awaiting_signature')
    .select('id')
  if (error) return NextResponse.json({ error: 'Could not record that. Please try again.' }, { status: 500 })
  if (!updated?.length) {
    return NextResponse.json({ error: 'This purchase order was signed a moment ago by somebody else.' }, { status: 409 })
  }

  await supabase.from('document_events').insert({
    doc_type: 'purchase_order', doc_id: po.id, event: 'signed',
    meta: { name, title, email, ip, ua, number: po.number },
  })

  // Tell Cardtly, after the signature is safely recorded: a lost notification
  // is an inconvenience, a lost signature is the business.
  try {
    const key = process.env.RESEND_API_KEY
    if (key) {
      const { subject, html } = renderPurchaseOrderSignedEmail({
        number: po.number,
        clientName: po.buyer_snapshot?.name || 'A client',
        signerName: name,
        signerTitle: title,
        signerEmail: email,
        signedAt,
        totalFormatted: formatMoney(po.total_cents, po.currency || 'ZAR'),
        reference: po.source_label || null,
        ip,
      })
      await new Resend(key).emails.send({
        from: FROM_EMAIL,
        to: QUOTE_ACCEPTED_TO,
        cc: [QUOTE_ACCEPTED_CC],
        subject,
        html,
      })
    }
  } catch (e) {
    console.error('purchase order signed notification failed', e)
  }

  return NextResponse.json({ ok: true, status: 'signed', signedAt, signerName: name, signerTitle: title })
}
