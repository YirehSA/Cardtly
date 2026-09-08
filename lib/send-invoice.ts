import { Resend } from 'resend'
import { FROM_EMAIL } from './email'
import { renderInvoiceEmail } from './billing-email-templates'
import { renderDocumentPdf, pdfFilename } from './pdf/render'
import { docViewFromInvoice } from './billing-view'
import { formatMoney, invoiceOutstanding } from './billing-docs'
import type { ChaseRow } from './overdue-chasing'

// Emailing an invoice, in one place.
//
// Three callers need it - the Send button, the chasing queue and the daily cron
// - and an invoice that arrives with the terms attached from one of them and
// without from another is the kind of inconsistency nobody notices until a
// client points it out.
//
// Every send writes a document_event. That log is not decoration: it is what
// findOverdue counts to decide which rung of the ladder an invoice is on, so a
// send that does not record itself would chase the same client forever.

export interface SendResult { ok: true; to: string; messageId: string | null }
export interface SendFailure { ok: false; error: string }

export async function sendInvoiceEmail(
  db: any,
  opts: {
    invoiceId: string
    to?: string | null
    cc?: string | null
    message?: string | null
    reminder?: boolean
    reminderStage?: { stage: number; isFinal: boolean; daysOverdue: number } | null
    actor?: string | null
  },
): Promise<SendResult | SendFailure> {
  const key = process.env.RESEND_API_KEY
  if (!key) return { ok: false, error: 'Email is not configured on this deployment.' }

  const { data: invoice } = await db
    .from('invoices').select('*').eq('id', opts.invoiceId).maybeSingle()
  if (!invoice) return { ok: false, error: 'No such invoice' }

  if (!invoice.number || invoice.status === 'draft') {
    return { ok: false, error: 'This invoice is still a draft. Issue it first.' }
  }
  if (invoice.status === 'cancelled') {
    return { ok: false, error: `Invoice ${invoice.number} is cancelled.` }
  }

  const to = String(opts.to || invoice.to_snapshot?.email || '').trim()
  if (!to || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) {
    return { ok: false, error: 'No email address for this client.' }
  }

  const { data: lines } = await db
    .from('invoice_lines').select('*').eq('invoice_id', invoice.id).order('position')

  // Credits count towards what is owed, so a chaser cannot ask for money a
  // credit note has already taken back.
  const { data: credits } = await db
    .from('credit_notes').select('total_cents').eq('invoice_id', invoice.id).eq('status', 'issued')
  const credited = (credits || []).reduce((n: number, c: any) => n + (c.total_cents || 0), 0)
  const outstanding = invoiceOutstanding(invoice.total_cents || 0, invoice.paid_cents || 0, credited)

  const { subject, html } = renderInvoiceEmail({
    number: invoice.number,
    clientName: invoice.to_snapshot?.name || 'there',
    totalFormatted: formatMoney(invoice.total_cents, invoice.currency || 'ZAR'),
    outstandingFormatted: outstanding !== invoice.total_cents
      ? formatMoney(outstanding, invoice.currency || 'ZAR') : null,
    dueDate: invoice.due_at || null,
    isReminder: !!opts.reminder,
    reminderStage: opts.reminderStage || null,
    message: opts.message?.trim() || null,
    from: {
      legalName: invoice.from_snapshot?.legalName,
      regNumber: invoice.from_snapshot?.regNumber,
      email: invoice.from_snapshot?.email,
    },
    bank: invoice.bank_snapshot || null,
  })

  let pdf: Buffer
  try {
    pdf = await renderDocumentPdf(docViewFromInvoice(invoice, lines || []))
  } catch (e: any) {
    return { ok: false, error: `Could not render the PDF: ${e?.message || 'unknown error'}` }
  }

  const resend = new Resend(key)
  const { data: sent, error } = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    ...(opts.cc ? { cc: String(opts.cc).split(',').map(s => s.trim()).filter(Boolean) } : {}),
    subject,
    html,
    attachments: [{ filename: pdfFilename(docViewFromInvoice(invoice, lines || [])), content: pdf.toString('base64') }],
  })
  if (error) return { ok: false, error: error.message || 'Resend refused the message' }

  await db.from('document_events').insert({
    doc_type: 'invoice', doc_id: invoice.id,
    event: opts.reminder ? 'reminder_sent' : 'sent',
    actor: opts.actor || null,
    meta: {
      to, cc: opts.cc || null, message_id: sent?.id || null, subject,
      ...(opts.reminderStage ? { stage: opts.reminderStage.stage, days_overdue: opts.reminderStage.daysOverdue } : {}),
    },
  })

  // Only from 'issued'. An invoice that is part paid or overdue has already
  // been out, and moving it back to 'sent' would erase that.
  if (invoice.status === 'issued') {
    await db.from('invoices')
      .update({ status: 'sent', updated_at: new Date().toISOString() }).eq('id', invoice.id)
  }

  return { ok: true, to, messageId: sent?.id || null }
}

/** One row off the chasing queue, sent at the rung it is actually due. */
export async function sendInvoiceReminder(
  db: any,
  row: ChaseRow,
  actor?: string | null,
): Promise<SendResult | SendFailure> {
  return sendInvoiceEmail(db, {
    invoiceId: row.id,
    to: row.email,
    reminder: true,
    reminderStage: { stage: row.stage, isFinal: row.isFinal, daysOverdue: row.daysOverdue },
    actor,
  })
}
