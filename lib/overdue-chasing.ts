import { reminderDue, invoiceOutstanding, statusAfterPayment, REMINDER_LADDER } from './billing-docs'

// Who is late, which rung of the ladder they are on, and marking them overdue.
//
// Shared by the admin queue and the daily cron so the two cannot disagree
// about who is being chased. The queue is what a person sees before pressing
// send; the cron uses the same list either to mark statuses only, or to send,
// depending on a setting that is off by default.

export interface ChaseRow {
  id: string
  number: string | null
  clientId: string
  clientName: string
  email: string | null
  dueAt: string
  daysOverdue: number
  totalCents: number
  outstandingCents: number
  stage: number
  isFinal: boolean
  remindersSent: number
  lastReminderAt: string | null
}

/**
 * Everything currently owed and past its due date, with the chase each one is
 * due. Reads only; sending is a separate act.
 */
export async function findOverdue(admin: any, today = new Date()): Promise<{
  rows: ChaseRow[]
  ladder: number[]
  autoSend: boolean
  problems: string[]
}> {
  const problems: string[] = []

  const { data: settings } = await admin
    .from('billing_settings').select('*').eq('id', true).maybeSingle()
  const ladder: number[] = Array.isArray(settings?.reminder_days) && settings.reminder_days.length
    ? settings.reminder_days
    : REMINDER_LADDER
  const autoSend = !!settings?.auto_send_reminders

  const { data: invoices, error } = await admin
    .from('invoices').select('*')
    .in('status', ['issued', 'sent', 'part_paid', 'overdue'])
    .not('due_at', 'is', null)
  if (error) {
    problems.push(`could not read invoices: ${error.message}`)
    return { rows: [], ladder, autoSend, problems }
  }
  if (!invoices?.length) return { rows: [], ladder, autoSend, problems }

  const ids = invoices.map((i: any) => i.id)

  // Credits count towards settling, so a credited invoice must never be chased.
  const { data: credits } = await admin
    .from('credit_notes').select('invoice_id, total_cents')
    .in('invoice_id', ids).eq('status', 'issued')
  const creditedBy: Record<string, number> = {}
  for (const c of credits || []) {
    creditedBy[c.invoice_id] = (creditedBy[c.invoice_id] || 0) + (c.total_cents || 0)
  }

  // How many reminders have actually gone out. The event log is the record
  // rather than a counter column: a counter can drift, and "when did we last
  // chase them" is a question worth being able to answer exactly.
  const { data: events } = await admin
    .from('document_events').select('doc_id, created_at')
    .eq('doc_type', 'invoice').eq('event', 'reminder_sent').in('doc_id', ids)
  const sentBy: Record<string, string[]> = {}
  for (const e of events || []) (sentBy[e.doc_id] ||= []).push(e.created_at)

  const { data: clients } = await admin.from('billing_clients').select('id, name, email')
  const clientById = Object.fromEntries((clients || []).map((c: any) => [c.id, c]))

  const rows: ChaseRow[] = []
  for (const inv of invoices) {
    const outstanding = invoiceOutstanding(
      inv.total_cents || 0, inv.paid_cents || 0, creditedBy[inv.id] || 0)
    const sent = (sentBy[inv.id] || []).sort()
    const chase = reminderDue({
      dueOn: inv.due_at,
      outstandingCents: outstanding,
      remindersSent: sent.length,
      ladder,
      today,
    })
    if (!chase.due) continue

    const client = clientById[inv.client_id] || {}
    rows.push({
      id: inv.id,
      number: inv.number,
      clientId: inv.client_id,
      clientName: client.name || 'Unknown client',
      // The snapshot first: an invoice was addressed to somebody, and that is
      // who should be chased about it, even if the client record has moved on.
      email: inv.to_snapshot?.email || client.email || null,
      dueAt: inv.due_at,
      daysOverdue: chase.daysOverdue,
      totalCents: inv.total_cents || 0,
      outstandingCents: outstanding,
      stage: chase.stage,
      isFinal: chase.isFinal,
      remindersSent: sent.length,
      lastReminderAt: sent.length ? sent[sent.length - 1] : null,
    })
  }

  rows.sort((a, b) => b.daysOverdue - a.daysOverdue)
  return { rows, ladder, autoSend, problems }
}

/**
 * Mark anything past its due date as overdue.
 *
 * Separate from chasing on purpose: an invoice one day late IS overdue and
 * should read that way on the screen, long before anybody emails about it. It
 * also puts a status back when a payment or a credit settles the balance.
 */
export async function markOverdue(admin: any, today = new Date()): Promise<{ changed: number }> {
  const { data: invoices } = await admin
    .from('invoices').select('id, total_cents, paid_cents, due_at, status')
    .in('status', ['issued', 'sent', 'part_paid', 'overdue'])
  if (!invoices?.length) return { changed: 0 }

  const ids = invoices.map((i: any) => i.id)
  const { data: credits } = await admin
    .from('credit_notes').select('invoice_id, total_cents')
    .in('invoice_id', ids).eq('status', 'issued')
  const creditedBy: Record<string, number> = {}
  for (const c of credits || []) {
    creditedBy[c.invoice_id] = (creditedBy[c.invoice_id] || 0) + (c.total_cents || 0)
  }

  let changed = 0
  for (const i of invoices) {
    const next = statusAfterPayment(
      i.total_cents, i.paid_cents, i.due_at, today, creditedBy[i.id] || 0)
    if (next !== i.status) {
      await admin.from('invoices')
        .update({ status: next, updated_at: new Date().toISOString() }).eq('id', i.id)
      changed++
    }
  }
  return { changed }
}
