// The two emails a meeting request sends: one to the card owner, and a
// receipt to the person who asked.
//
// Built here rather than inline in the route so scripts/check-booking-request
// can render both and confirm every detail the visitor gave is in them, and
// that none of it can inject markup. Every value except the formatted date and
// time was typed by an anonymous visitor, so all of it is escaped.

import { formatBookingDate, formatBookingDateShort, formatBookingTime, formatSentAt } from './booking-format'

export interface BookingDetails {
  requesterName: string
  requesterEmail: string
  requesterPhone: string | null
  /** YYYY-MM-DD, already checked. */
  date: string
  /** HH:MM, already checked, or null for any time. */
  time: string | null
  timeZone: string | null
  notes: string | null
  cardName: string
  cardTitle: string
  cardCompany: string
  cardUrl: string | null
  isTeam: boolean
  sentAt: Date
  /** A wa.me link to the visitor, when their number makes one. */
  whatsappUrl: string | null
}

export interface BuiltEmail { subject: string; html: string; text: string }

export function esc(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

// A subject line is plain text, but a stray line break in one is a header
// injection waiting to happen.
function oneLine(v: string): string {
  return v.replace(/[\r\n]+/g, ' ').trim()
}

function telHref(phone: string): string {
  return 'tel:' + phone.replace(/[^\d+]/g, '')
}

function row(label: string, valueHtml: string): string {
  return `<tr>
      <td style="padding:7px 14px 7px 0;color:#6b7280;font-size:13px;vertical-align:top;white-space:nowrap">${label}</td>
      <td style="padding:7px 0;color:#111827;font-size:14px;vertical-align:top;line-height:1.5">${valueHtml}</td>
    </tr>`
}

function button(href: string, label: string, bg: string): string {
  return `<a href="${esc(href)}" style="display:inline-block;background:${bg};color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:11px 20px;border-radius:10px;margin:0 8px 8px 0">${label}</a>`
}

/** "Lenny Govender, Sales Manager, Acme". */
function cardLine(d: BookingDetails): string {
  return [d.cardName, d.cardTitle, d.cardCompany].map(s => (s || '').trim()).filter(Boolean).join(', ')
}

export function ownerBookingEmail(d: BookingDetails): BuiltEmail {
  const name = d.requesterName.trim()
  const first = name.split(/\s+/)[0] || name
  const dateLong = formatBookingDate(d.date)
  const timeText = formatBookingTime(d.time, d.timeZone)
  const sent = `${formatSentAt(d.sentAt)} (South African time)`
  const card = cardLine(d)
  const note = (d.notes || '').trim()
  const phone = (d.requesterPhone || '').trim()

  const subject = oneLine(`Meeting request from ${name}: ${formatBookingDateShort(d.date)}, ${d.time || 'any time'}`)
  const replyHref = `mailto:${d.requesterEmail}?subject=${encodeURIComponent(`Re: your meeting request for ${dateLong}`)}`

  const html = `
  <div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111827;background:#ffffff">
    <h2 style="margin:0 0 8px;font-size:20px">New meeting request</h2>
    <p style="margin:0 0 18px;color:#4b5563;font-size:15px;line-height:1.6">
      ${esc(name)} would like to meet you. Nothing is booked yet: confirm a time with them first. Replying to this email goes straight to ${esc(first)}.
    </p>
    <div style="background:#f6f7f9;border-radius:12px;padding:14px 18px;margin:0 0 18px">
      <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%">
        ${row('Name', esc(name))}
        ${row('Email', `<a href="mailto:${esc(d.requesterEmail)}" style="color:#4f46e5">${esc(d.requesterEmail)}</a>`)}
        ${row('Phone', phone ? `<a href="${esc(telHref(phone))}" style="color:#4f46e5">${esc(phone)}</a>` : '<span style="color:#9ca3af">Not given</span>')}
        ${row('Date', `<strong>${esc(dateLong)}</strong>`)}
        ${row('Time', `<strong>${esc(timeText)}</strong>`)}
        ${row('About', note ? `<span style="white-space:pre-wrap">${esc(note)}</span>` : '<span style="color:#9ca3af">No note added</span>')}
        ${row('Card', card ? (d.cardUrl ? `<a href="${esc(d.cardUrl)}" style="color:#4f46e5">${esc(card)}</a>` : esc(card)) : '<span style="color:#9ca3af">Your card</span>')}
        ${row('Sent', esc(sent))}
      </table>
    </div>
    <div style="margin:0 0 8px">
      ${button(replyHref, `Reply to ${esc(first)}`, '#4f46e5')}
      ${d.whatsappUrl ? button(d.whatsappUrl, 'Reply on WhatsApp', '#25D366') : ''}
      ${phone ? button(telHref(phone), `Call ${esc(first)}`, '#111827') : ''}
    </div>
    <p style="font-size:12px;color:#9ca3af;margin:20px 0 0;line-height:1.6">
      Saved in your contacts${d.isTeam ? ', and your team admin can see it in Team Contacts' : ''}. Sent by Cardtly because someone asked for a meeting on your card.
    </p>
  </div>`

  const text = [
    'New meeting request',
    `${name} would like to meet you. Nothing is booked yet: confirm a time with them first.`,
    '',
    `Name:  ${name}`,
    `Email: ${d.requesterEmail}`,
    `Phone: ${phone || 'Not given'}`,
    `Date:  ${dateLong}`,
    `Time:  ${timeText}`,
    `About: ${note || 'No note added'}`,
    `Card:  ${card || 'Your card'}${d.cardUrl ? ` (${d.cardUrl})` : ''}`,
    `Sent:  ${sent}`,
    '',
    `Reply to this email to answer ${first}.`,
  ].join('\n')

  return { subject, html, text }
}

export function requesterBookingEmail(d: BookingDetails): BuiltEmail {
  const name = d.requesterName.trim()
  const first = name.split(/\s+/)[0] || name
  const who = (d.cardName || '').trim() || 'them'
  const dateLong = formatBookingDate(d.date)
  const timeText = formatBookingTime(d.time, d.timeZone)
  const card = cardLine(d)
  const note = (d.notes || '').trim()
  const phone = (d.requesterPhone || '').trim()

  const subject = oneLine(`Your meeting request to ${who === 'them' ? 'Cardtly' : who}`)

  // Carefully NOT a confirmation: nobody has agreed to this time yet. Saying
  // "your meeting is booked" would have them turning up to a date the card
  // owner has not seen. No calendar attachment for the same reason - see
  // lib/meeting-invite, where an invitation only goes out once a meeting
  // actually exists.
  const html = `
  <div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#111827;background:#ffffff">
    <h1 style="font-size:21px;margin:0 0 8px">Your request is with ${esc(who)}</h1>
    <p style="color:#4b5563;font-size:15px;line-height:1.6;margin:0 0 20px">
      ${first ? `Hi ${esc(first)}, ` : ''}we have passed this on. ${esc(who)} will confirm the time with you directly, so treat it as requested rather than booked until you hear back.
    </p>
    <div style="background:#f6f7f9;border-radius:12px;padding:14px 18px;margin:0 0 20px">
      <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%">
        ${row('Meeting with', d.cardUrl ? `<a href="${esc(d.cardUrl)}" style="color:#4f46e5">${esc(card || who)}</a>` : esc(card || who))}
        ${row('Date', `<strong>${esc(dateLong)}</strong>`)}
        ${row('Time', `<strong>${esc(timeText)}</strong>`)}
        ${row('Your email', esc(d.requesterEmail))}
        ${row('Your phone', phone ? esc(phone) : '<span style="color:#9ca3af">Not given</span>')}
        ${row('Your note', note ? `<span style="white-space:pre-wrap">${esc(note)}</span>` : '<span style="color:#9ca3af">None</span>')}
      </table>
    </div>
    <p style="color:#9ca3af;font-size:13px;line-height:1.6;margin:0">
      Reply to this email to reach ${esc(who)}. Sent by Cardtly because you asked for a meeting on their digital card.
    </p>
  </div>`

  const text = [
    `Your request is with ${who}`,
    `${first ? `Hi ${first}, ` : ''}we have passed this on. ${who} will confirm the time with you directly, so treat it as requested rather than booked until you hear back.`,
    '',
    `Meeting with: ${card || who}${d.cardUrl ? ` (${d.cardUrl})` : ''}`,
    `Date:         ${dateLong}`,
    `Time:         ${timeText}`,
    `Your email:   ${d.requesterEmail}`,
    `Your phone:   ${phone || 'Not given'}`,
    `Your note:    ${note || 'None'}`,
    '',
    `Reply to this email to reach ${who}.`,
  ].join('\n')

  return { subject, html, text }
}
