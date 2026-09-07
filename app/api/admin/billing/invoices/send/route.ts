import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { requireAdmin, adminDb } from '@/lib/admin-api'
import { FROM_EMAIL } from '@/lib/email'
import { renderInvoiceEmail } from '@/lib/billing-email-templates'
import { renderDocumentPdf, pdfFilename } from '@/lib/pdf/render'
import { docViewFromInvoice } from '@/lib/billing-view'
import { formatMoney } from '@/lib/billing-docs'

// Emailing an invoice, with the PDF attached.
//
// Only an ISSUED invoice can go out. A draft has no number, is not a document,
// and emailing one would put a figure in front of a client that is still
// editable on this side - the exact thing the draft/issued split exists to
// prevent.
//
// The PDF is rendered here from the document's own snapshot rather than being
// looked up, so the attachment is the same file the Invoices screen shows and
// the same one it will show in five years.

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const gate = await requireAdmin()
  if ('error' in gate) return gate.error

  const body = await request.json().catch(() => ({}))
  if (!body?.id) return NextResponse.json({ error: 'Which invoice?' }, { status: 400 })

  const key = process.env.RESEND_API_KEY
  if (!key) return NextResponse.json({ error: 'Email is not configured on this deployment.' }, { status: 503 })

  const db = adminDb()
  const { data: invoice } = await db.from('invoices').select('*').eq('id', body.id).maybeSingle()
  if (!invoice) return NextResponse.json({ error: 'No such invoice' }, { status: 404 })

  if (!invoice.number || invoice.status === 'draft') {
    return NextResponse.json({
      error: 'This invoice is still a draft. Issue it first: emailing a figure that can still be edited on our side is what issuing exists to prevent.',
    }, { status: 409 })
  }
  if (invoice.status === 'cancelled') {
    return NextResponse.json({ error: `Invoice ${invoice.number} is cancelled.` }, { status: 409 })
  }

  // The recipient. Falls back to whoever the invoice was addressed to when it
  // was issued, which is the address on the document itself.
  const to = String(body.to || invoice.to_snapshot?.email || '').trim()
  if (!to || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) {
    return NextResponse.json({
      error: 'No email address for this client. Add one on the Clients screen, or type one here.',
    }, { status: 400 })
  }

  const { data: lines } = await db
    .from('invoice_lines').select('*').eq('invoice_id', invoice.id).order('position')

  const view = docViewFromInvoice(invoice, lines || [])
  const outstanding = Math.max(0, (invoice.total_cents || 0) - (invoice.paid_cents || 0))

  const { subject, html } = renderInvoiceEmail({
    number: invoice.number,
    clientName: invoice.to_snapshot?.name || 'there',
    totalFormatted: formatMoney(invoice.total_cents, invoice.currency || 'ZAR'),
    outstandingFormatted: outstanding !== invoice.total_cents
      ? formatMoney(outstanding, invoice.currency || 'ZAR') : null,
    dueDate: invoice.due_at || null,
    isReminder: !!body.reminder,
    message: typeof body.message === 'string' ? body.message.trim() || null : null,
    from: {
      legalName: invoice.from_snapshot?.legalName,
      regNumber: invoice.from_snapshot?.regNumber,
      email: invoice.from_snapshot?.email,
    },
    bank: invoice.bank_snapshot || null,
  })

  let pdf: Buffer
  try {
    pdf = await renderDocumentPdf(view)
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
    attachments: [{ filename: pdfFilename(view), content: pdf.toString('base64') }],
  })

  if (error) {
    return NextResponse.json({ error: error.message || 'Resend refused the message' }, { status: 502 })
  }

  // Recorded whether or not the status moves, because "when did we send it and
  // to whom" is the question that actually gets asked, and a second send is as
  // worth knowing about as the first.
  await db.from('document_events').insert({
    doc_type: 'invoice', doc_id: invoice.id, event: body.reminder ? 'reminder_sent' : 'sent',
    actor: gate.user.id,
    meta: { to, cc: body.cc || null, message_id: sent?.id || null, subject },
  })

  // Only from 'issued'. An invoice that is part paid or overdue has already
  // been out; moving it back to 'sent' would erase that.
  if (invoice.status === 'issued') {
    await db.from('invoices')
      .update({ status: 'sent', updated_at: new Date().toISOString() }).eq('id', invoice.id)
  }

  return NextResponse.json({ ok: true, to, messageId: sent?.id || null })
}

/** When it last went out, and to whom. */
export async function GET(request: Request) {
  const gate = await requireAdmin()
  if ('error' in gate) return gate.error

  const id = new URL(request.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Which invoice?' }, { status: 400 })

  const db = adminDb()
  const { data } = await db
    .from('document_events').select('*')
    .eq('doc_type', 'invoice').eq('doc_id', id)
    .in('event', ['sent', 'reminder_sent'])
    .order('created_at', { ascending: false })

  return NextResponse.json({ sends: data || [] })
}
