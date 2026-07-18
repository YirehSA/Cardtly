import { Resend } from 'resend'
import { waLink } from '@/lib/whatsapp'
import { FROM_EMAIL } from '@/lib/email'
import { resolveTeamAdminEmails, type CardOwner } from '@/lib/card-owner'

// Emails everyone who should see a new lead. Every public lead source uses this,
// so whichever form a visitor fills in - the card's contact form or a
// questionnaire - the same people hear about it in the same way:
//
//   - the person whose card it is, at the inboxes resolveCardOwner found (their
//     card's display address and, for a claimed card, their account address)
//   - for a team card, a copy to the company admin and to the head of the
//     card's department, who manage that person
//
// The two get different wording: the card holder is told it is their card, the
// admins are told whose card it is and why they are seeing it.
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

export interface LeadCopy {
  // Owner-facing wording.
  subject: string
  heading: string
  intro: string
  // Admin copy: short noun for the subject ('contact', 'questionnaire reply')
  // and what the visitor did ('filled in the contact form on').
  adminNoun: string
  adminAction: string
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function row(label: string, value: string): string {
  return `<p style="margin:0 0 6px"><strong>${esc(label)}:</strong> ${esc(value)}</p>`
}

async function send(
  to: string[],
  subject: string,
  heading: string,
  intro: string,
  footer: string,
  lead: LeadDetails
): Promise<void> {
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

  const resend = new Resend(process.env.RESEND_API_KEY)
  await resend.emails.send({
    from: FROM_EMAIL,
    to,
    replyTo: lead.email,
    subject,
    html: `
      <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111">
        <h2 style="margin:0 0 16px;font-size:20px">${esc(heading)}</h2>
        <p style="margin:0 0 16px;color:#555">${esc(intro)} Reply to this email to reach them.</p>
        <div style="background:#f6f6f6;border-radius:12px;padding:18px;margin-bottom:16px">
          ${row('Name', lead.name)}
          ${row('Email', lead.email)}
          ${lead.phone ? row('Phone', lead.phone) : ''}
          ${lead.company ? row('Company', lead.company) : ''}
          ${lead.message ? `<p style="margin:12px 0 0;white-space:pre-wrap"><strong>Message:</strong> ${esc(lead.message)}</p>` : ''}
        </div>
        ${answersBlock}
        ${wa ? `<a href="${wa}" style="display:inline-block;background:#25D366;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 22px;border-radius:10px;margin-bottom:8px">Reply on WhatsApp</a>` : ''}
        <p style="font-size:12px;color:#888;margin:24px 0 0">${esc(footer)}</p>
      </div>
    `,
  })
}

export async function notifyLeadRecipients(
  admin: any,
  owner: CardOwner,
  lead: LeadDetails,
  copy: LeadCopy
): Promise<void> {
  if (!process.env.RESEND_API_KEY) return

  // The person whose card it is.
  if (owner.ownerEmails.length > 0) {
    try {
      await send(
        owner.ownerEmails,
        copy.subject,
        copy.heading,
        copy.intro,
        `Card: ${owner.cardName}. Sent via Cardtly.${owner.isTeam ? ' Your team admin can also see this in Team Contacts.' : ''}`,
        lead
      )
    } catch {
      // Lead is already saved and visible in the dashboard.
    }
  }

  // A copy to whoever manages them, for team cards only.
  if (!owner.isTeam || !owner.teamCardId) return
  try {
    const admins = await resolveTeamAdminEmails(admin, owner.teamCardId, owner.ownerEmails)
    if (admins.length === 0) return
    const who = owner.cardName || 'a team member'
    await send(
      admins,
      `New ${copy.adminNoun} from ${lead.name} for ${who}`,
      `A lead came in for ${who}`,
      `A visitor ${copy.adminAction} ${who}'s Cardtly card, which is on your team.`,
      `Card: ${owner.cardName}. Sent via Cardtly. You are getting a copy because you manage this team - ${who} was notified too.`,
      lead
    )
  } catch {
    // The card holder has already been told; the admin copy is a bonus.
  }
}
