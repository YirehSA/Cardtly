import { Resend } from 'resend'
import { waLink } from '@/lib/whatsapp'
import { FROM_EMAIL } from '@/lib/email'
import type { CardOwner } from '@/lib/card-owner'

// Emails the card owner about a new lead. Every public lead source uses this,
// so whichever form a visitor fills in - the card's contact form, a booking
// request, or a questionnaire - the person whose card it is gets the same
// email, at the same inboxes resolveCardOwner found (their card's display
// address and, for a claimed card, their account address).
//
// replyTo is the visitor, deliberately: this is mail addressed to us on their
// behalf, so replying must reach them and not hello@cardtly.com. See lib/email.
//
// Best-effort by contract: the lead is already saved before this runs, so a
// mail failure must never fail the request or lose the lead.

export interface LeadDetails {
  name: string
  email: string
  phone?: string | null
  company?: string | null
  message?: string | null
  // Questionnaire answers, shown as their own block when present.
  answers?: { label: string; value: string }[] | null
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function row(label: string, value: string): string {
  return `<p style="margin:0 0 6px"><strong>${esc(label)}:</strong> ${esc(value)}</p>`
}

export async function notifyCardOwnerOfLead(
  owner: CardOwner,
  lead: LeadDetails,
  // What the visitor did, so the email says the right thing per source.
  source: { subject: string; heading: string; intro: string }
): Promise<void> {
  if (!process.env.RESEND_API_KEY || owner.ownerEmails.length === 0) return

  const firstName = lead.name.split(' ')[0]
  const wa = waLink(lead.phone, `Hi ${firstName}, thanks for reaching out via my Cardtly card.`)

  const answersBlock = lead.answers?.length
    ? `<div style="background:#f6f6f6;border-radius:12px;padding:18px;margin-bottom:16px">
         <p style="margin:0 0 10px;font-weight:600">Their answers</p>
         ${lead.answers.map(a => `
           <p style="margin:0 0 4px;color:#555;font-size:13px">${esc(a.label)}</p>
           <p style="margin:0 0 12px;white-space:pre-wrap">${esc(a.value)}</p>
         `).join('')}
       </div>`
    : ''

  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    await resend.emails.send({
      from: FROM_EMAIL,
      to: owner.ownerEmails,
      replyTo: lead.email,
      subject: source.subject,
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111">
          <h2 style="margin:0 0 16px;font-size:20px">${esc(source.heading)}</h2>
          <p style="margin:0 0 16px;color:#555">${esc(source.intro)} Reply to this email to reach them.</p>
          <div style="background:#f6f6f6;border-radius:12px;padding:18px;margin-bottom:16px">
            ${row('Name', lead.name)}
            ${row('Email', lead.email)}
            ${lead.phone ? row('Phone', lead.phone) : ''}
            ${lead.company ? row('Company', lead.company) : ''}
            ${lead.message ? `<p style="margin:12px 0 0;white-space:pre-wrap"><strong>Message:</strong> ${esc(lead.message)}</p>` : ''}
          </div>
          ${answersBlock}
          ${wa ? `<a href="${wa}" style="display:inline-block;background:#25D366;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 22px;border-radius:10px;margin-bottom:8px">Reply on WhatsApp</a>` : ''}
          <p style="font-size:12px;color:#888;margin:24px 0 0">Card: ${esc(owner.cardName)}. Sent via Cardtly.${owner.isTeam ? ' Your team admin can also see this in Team Contacts.' : ''}</p>
        </div>
      `,
    })
  } catch {
    // Lead is already saved and visible in the dashboard.
  }
}
