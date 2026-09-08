// Billing email bodies.
//
// Separate module from trial-email-templates for the same reason that one
// exists: a Next route file may only export HTTP handlers, so keeping the
// bodies here is what makes them renderable and testable without sending mail.

import { escapeHtml } from './trial-email-templates'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://cardtly.com'

const BTN =
  'display:inline-block;background:linear-gradient(135deg,#00d4ff,#7c3aed,#ec4899);color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:13px 26px;border-radius:11px'

function wrap(inner: string): string {
  return `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#111">${inner}
    <p style="color:#aaa;font-size:12px;margin:28px 0 0">You're getting this because you have a Cardtly card. Sent via Cardtly.</p>
  </div>`
}

export interface PaymentFailedInput {
  firstName: string
  slug: string | null
  /** Whole days left before the card stops serving. */
  daysLeft: number
}

// Sent once per past-due episode, the morning after Paystack reports a failed
// charge. The tone is deliberately not alarming: the usual cause is an expired
// bank card, Paystack retries on its own, and most of these resolve without the
// customer doing anything. What they need to know is that there is a deadline
// and what happens at the end of it.
export function renderPaymentFailedEmail({
  firstName,
  slug,
  daysLeft,
}: PaymentFailedInput): { subject: string; html: string } {
  const name = escapeHtml(firstName)
  const cardUrl = escapeHtml(slug ? `cardtly.com/card/${slug}` : 'your card')
  const window =
    daysLeft === 1 ? 'until tomorrow' : `for another ${daysLeft} days`

  return {
    subject: 'Your Cardtly payment did not go through',
    html: wrap(`
      <h1 style="font-size:22px;margin:0 0 4px">A payment issue, ${name}</h1>
      <p style="color:#666;font-size:14px;margin:0 0 20px">
        Your last Cardtly payment did not go through. It is usually something small,
        like a bank card that has expired since you signed up.
      </p>
      <p style="color:#666;font-size:14px;margin:0 0 20px">
        <strong>${cardUrl} is still live ${window}.</strong> If the payment is not
        settled by then, your card stops opening for anyone you have shared it with,
        including anything already printed or on an NFC card.
      </p>
      <p style="color:#666;font-size:14px;margin:0 0 24px">
        Nothing is deleted either way. Your design, your details and every contact you
        have captured stay exactly where they are.
      </p>
      <p style="margin:0 0 24px"><a href="${APP_URL}/upgrade" style="${BTN}">Update payment details</a></p>
      <p style="color:#999;font-size:13px;margin:0">
        Already paid? Then it has gone through and you can ignore this.
      </p>
    `),
  }
}

// ── Documents sent to a client ────────────────────────────────────────────
// A separate wrapper from wrap() above, which signs off "you're getting this
// because you have a Cardtly card". The person in an accounts department who
// receives an invoice usually has no card and never signed up for anything,
// so telling them they did is both wrong and slightly alarming.
function wrapDocument(inner: string, from: { legalName?: string; regNumber?: string | null; email?: string | null }): string {
  const legal = escapeHtml(from.legalName || 'Cardtly')
  const bits = [legal, from.regNumber ? `Registration No. ${escapeHtml(from.regNumber)}` : null]
    .filter(Boolean).join(' &middot; ')
  return `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#111">${inner}
    <p style="color:#aaa;font-size:12px;margin:28px 0 0;border-top:1px solid #eee;padding-top:14px">${bits}${
      from.email ? `<br>Questions about this invoice? Reply to this email or write to ${escapeHtml(from.email)}.` : ''
    }</p>
  </div>`
}

export interface InvoiceEmailInput {
  number: string
  clientName: string
  /** Already formatted, so the email and the PDF cannot disagree about it. */
  totalFormatted: string
  dueDate: string | null
  /** Set when some of it is already paid, so a reminder does not ask for the
   *  full amount again. */
  outstandingFormatted?: string | null
  isReminder?: boolean
  /** Which rung of the chasing ladder, so the wording can escalate. Absent for
   *  a first send and for a reminder sent by hand without a stage. */
  reminderStage?: { stage: number; isFinal: boolean; daysOverdue: number } | null
  /** A note typed by whoever is sending it. Plain text; escaped here. */
  message?: string | null
  from: { legalName?: string; regNumber?: string | null; email?: string | null }
  bank?: {
    bankName?: string | null; accountName?: string | null; accountNumber?: string | null
    branchCode?: string | null; accountType?: string | null
  } | null
}

/**
 * The email an invoice goes out on.
 *
 * The banking details come from the document's own snapshot rather than from
 * settings, for the same reason the PDF does: the email body and the attachment
 * have to say the same thing, and settings can change between issuing an
 * invoice and chasing it.
 */
export function renderInvoiceEmail({
  number, clientName, totalFormatted, dueDate, outstandingFormatted,
  isReminder, reminderStage, message, from, bank,
}: InvoiceEmailInput): { subject: string; html: string } {
  const tone = isReminder && reminderStage ? reminderTone(reminderStage) : null
  const n = escapeHtml(number)
  const owing = outstandingFormatted && outstandingFormatted !== totalFormatted
  const rows: string[] = []
  if (bank?.accountNumber) {
    for (const [k, v] of [
      ['Bank', bank.bankName], ['Account name', bank.accountName],
      ['Account number', bank.accountNumber], ['Branch code', bank.branchCode],
      ['Account type', bank.accountType],
    ] as [string, string | null | undefined][]) {
      if (v) rows.push(
        `<tr><td style="color:#888;font-size:13px;padding:2px 12px 2px 0">${k}</td>` +
        `<td style="font-size:13px;font-weight:600">${escapeHtml(v)}</td></tr>`)
    }
  }

  return {
    subject: tone?.heading === 'Final notice'
      ? `Final notice: invoice ${number} is overdue`
      : isReminder
        ? `Reminder: invoice ${number} from Cardtly`
        : `Invoice ${number} from Cardtly`,
    html: wrapDocument(`
      <h1 style="font-size:21px;margin:0 0 4px">${
        tone ? escapeHtml(tone.heading) : isReminder ? 'A reminder about invoice' : 'Invoice'
      } ${n}</h1>
      <p style="color:#666;font-size:14px;margin:0 0 20px">
        Hello ${escapeHtml(clientName)}, ${
          tone ? escapeHtml(tone.opening) : 'the invoice is attached as a PDF.'
        }
      </p>
      ${message ? `<p style="color:#444;font-size:14px;margin:0 0 20px;white-space:pre-wrap">${escapeHtml(message)}</p>` : ''}
      <table style="border-collapse:collapse;margin:0 0 20px">
        <tr><td style="color:#888;font-size:13px;padding:2px 12px 2px 0">Invoice</td>
            <td style="font-size:13px;font-weight:600">${n}</td></tr>
        <tr><td style="color:#888;font-size:13px;padding:2px 12px 2px 0">Total</td>
            <td style="font-size:13px;font-weight:600">${escapeHtml(totalFormatted)}</td></tr>
        ${owing ? `<tr><td style="color:#888;font-size:13px;padding:2px 12px 2px 0">Still owing</td>
            <td style="font-size:13px;font-weight:700">${escapeHtml(outstandingFormatted!)}</td></tr>` : ''}
        ${dueDate ? `<tr><td style="color:#888;font-size:13px;padding:2px 12px 2px 0">Due</td>
            <td style="font-size:13px;font-weight:600">${escapeHtml(dueDate)}</td></tr>` : ''}
      </table>
      ${rows.length ? `
        <p style="color:#888;font-size:11px;letter-spacing:1px;margin:0 0 6px">BANKING DETAILS</p>
        <table style="border-collapse:collapse;margin:0 0 12px">${rows.join('')}</table>
        <p style="color:#444;font-size:13px;margin:0 0 20px">
          Please use <strong>${n}</strong> as your payment reference.
        </p>` : ''}
      ${tone ? `<p style="color:#666;font-size:13.5px;margin:0">${escapeHtml(tone.closing)}</p>` : ''}
    `, from),
  }
}

// Quotes are deliberately NOT emailed from here.
//
// Cardtly sends them out by hand, with the business proposal around them, so
// there is no quote template and no quote send route. The accept link on the
// Quotes screen is what a client follows to sign; it is copied into whatever
// email the proposal goes out in.
//
// scripts/check-quote-access fails if a send route reappears.

export interface ReminderToneInput {
  stage: number
  isFinal: boolean
  daysOverdue: number
}

/**
 * How firm to be, and the words for it.
 *
 * Escalation matters. The same sentence sent three times reads as an
 * autoresponder nobody is behind, and a first nudge written like a final
 * demand loses a client over an invoice that went to somebody's spam folder.
 *
 * Kept here, next to the templates, because the wording IS the decision.
 */
export function reminderTone({ stage, isFinal, daysOverdue }: ReminderToneInput): {
  heading: string
  opening: string
  closing: string
} {
  if (isFinal) {
    return {
      heading: 'Final notice',
      opening:
        `This invoice is now ${daysOverdue} days past its due date and remains unpaid. ` +
        `We would rather sort this out with you than escalate it.`,
      closing:
        'If there is a problem with the invoice, or you need more time, please reply and tell us. ' +
        'We can usually work something out. If it has already been paid, please send the proof of payment and we will clear it.',
    }
  }
  if (stage === 1) {
    return {
      heading: 'A gentle reminder',
      opening:
        `This invoice fell due ${daysOverdue} days ago and we have not seen the payment yet. ` +
        `It is very often just an email that went to the wrong folder.`,
      closing: 'If it has already been paid, thank you, and please ignore this.',
    }
  }
  return {
    heading: 'Still outstanding',
    opening:
      `This invoice is ${daysOverdue} days past its due date. ` +
      `We sent a reminder already and have not heard back.`,
    closing:
      'If there is something holding it up, please reply and let us know. ' +
      'If it has already been paid, please send the proof of payment.',
  }
}
