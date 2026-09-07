import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { requireAdmin, adminDb } from '@/lib/admin-api'
import { FROM_EMAIL } from '@/lib/email'
import { renderQuoteEmail } from '@/lib/billing-email-templates'
import { renderDocumentPdf, pdfFilename } from '@/lib/pdf/render'
import { docViewFromQuote, isQuoteExpired } from '@/lib/billing-view'
import { formatMoney } from '@/lib/billing-docs'

// Emailing a quote: the PDF for their records, and a link to the page where it
// can actually be accepted.

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const gate = await requireAdmin()
  if ('error' in gate) return gate.error

  const body = await request.json().catch(() => ({}))
  if (!body?.id) return NextResponse.json({ error: 'Which quote?' }, { status: 400 })

  const key = process.env.RESEND_API_KEY
  if (!key) return NextResponse.json({ error: 'Email is not configured on this deployment.' }, { status: 503 })

  const db = adminDb()
  const { data: quote } = await db.from('quotes').select('*').eq('id', body.id).maybeSingle()
  if (!quote) return NextResponse.json({ error: 'No such quote' }, { status: 404 })

  if (!quote.number || quote.status === 'draft') {
    return NextResponse.json({
      error: 'This quote is still a draft. Issue it first, so what the client accepts is fixed.',
    }, { status: 409 })
  }
  if (quote.status === 'cancelled') {
    return NextResponse.json({ error: `Quote ${quote.number} is cancelled.` }, { status: 409 })
  }
  if (isQuoteExpired(quote)) {
    return NextResponse.json({
      error: `Quote ${quote.number} lapsed on ${quote.valid_until}, so the client could not accept it. Raise a new one.`,
    }, { status: 409 })
  }
  if (!quote.public_token) {
    return NextResponse.json({ error: 'This quote has no accept link. Re-issue it.' }, { status: 409 })
  }

  const to = String(body.to || quote.to_snapshot?.email || '').trim()
  if (!to || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) {
    return NextResponse.json({
      error: 'No email address for this client. Add one on the Clients screen, or type one here.',
    }, { status: 400 })
  }

  const { data: lines } = await db
    .from('quote_lines').select('*').eq('quote_id', quote.id).order('position')

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://cardtly.com'
  const { subject, html } = renderQuoteEmail({
    number: quote.number,
    clientName: quote.to_snapshot?.name || 'there',
    totalFormatted: formatMoney(quote.total_cents, quote.currency || 'ZAR'),
    validUntil: quote.valid_until || null,
    acceptUrl: `${appUrl}/quote/${quote.public_token}`,
    message: typeof body.message === 'string' ? body.message.trim() || null : null,
    from: {
      legalName: quote.from_snapshot?.legalName,
      regNumber: quote.from_snapshot?.regNumber,
      email: quote.from_snapshot?.email,
    },
  })

  let pdf: Buffer
  try {
    pdf = await renderDocumentPdf(docViewFromQuote(quote, lines || []))
  } catch (e: any) {
    return NextResponse.json({ error: `Could not render the PDF: ${e?.message || 'unknown error'}` }, { status: 500 })
  }

  const resend = new Resend(key)
  const { data: sent, error } = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    ...(body.cc ? { cc: String(body.cc).split(',').map((s: string) => s.trim()).filter(Boolean) } : {}),
    subject,
    html,
    attachments: [{ filename: pdfFilename(docViewFromQuote(quote, lines || [])), content: pdf.toString('base64') }],
  })
  if (error) return NextResponse.json({ error: error.message || 'Resend refused the message' }, { status: 502 })

  await db.from('document_events').insert({
    doc_type: 'quote', doc_id: quote.id, event: 'sent', actor: gate.user.id,
    meta: { to, cc: body.cc || null, message_id: sent?.id || null },
  })

  // Only from 'issued'. A quote already accepted or declined must not be
  // walked back to 'sent' by somebody forwarding a copy.
  if (quote.status === 'issued') {
    await db.from('quotes')
      .update({ status: 'sent', updated_at: new Date().toISOString() }).eq('id', quote.id)
  }

  return NextResponse.json({ ok: true, to, messageId: sent?.id || null })
}

export async function GET(request: Request) {
  const gate = await requireAdmin()
  if ('error' in gate) return gate.error

  const id = new URL(request.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Which quote?' }, { status: 400 })

  const db = adminDb()
  const { data } = await db
    .from('document_events').select('*')
    .eq('doc_type', 'quote').eq('doc_id', id)
    .order('created_at', { ascending: false })
  return NextResponse.json({ events: data || [] })
}
