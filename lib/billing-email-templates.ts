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
