import { Resend } from 'resend'
import { FROM_EMAIL } from './email'
import { buildIcs } from './ics'
import { meetingDuration, type RepMeeting } from './rep-meetings'
import { calendarLinks } from './calendar-links'

// Telling Cardtly that a rep has booked something.
//
// A rep booking an appointment used to write it into their own calendar and
// nothing else happened, so the rep's real diary - the one on their phone with
// the alarm in it - never heard about it. It now goes to them by email with the
// calendar file attached, and a copy goes to the office.
//
// In-house only, deliberately. This did email the client as well, and that is
// exactly what it must not do: the rep arranges the meeting with them, and an
// automated "your meeting is confirmed" from a company they have not agreed to
// meet yet is not ours to send. The address on the meeting is shown in the mail
// so somebody here can confirm it; nothing is sent to it.

const RECIPIENT_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// The office copy. Every booking lands here so somebody other than the rep can
// see the diary filling up, and so a rep with no address on their record still
// produces a record of the appointment somewhere.
const SUPPORT_EMAIL = 'support@cardtly.com'

// Everyone this is for is in South Africa, and a time with no zone on it is the
// oldest way to have two people turn up an hour apart.
const TIME_ZONE = 'Africa/Johannesburg'

function esc(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function when(m: RepMeeting): string {
  const d = new Date(m.scheduled_at)
  if (!Number.isFinite(d.getTime())) return 'a date we could not read'
  const date = d.toLocaleDateString('en-ZA', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: TIME_ZONE,
  })
  const time = d.toLocaleTimeString('en-ZA', {
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TIME_ZONE,
  })
  return `${date} at ${time}`
}

function shortWhen(m: RepMeeting): string {
  const d = new Date(m.scheduled_at)
  if (!Number.isFinite(d.getTime())) return ''
  return d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', timeZone: TIME_ZONE })
}

export type InviteAction = 'new' | 'updated' | 'cancelled'

/**
 * A meeting worth telling anyone about: still going to happen, and not called
 * off.
 *
 * This is the guard that keeps the feature from being a liability. The calendar
 * is used to write meetings up as well as to book them - the whole point of
 * only needing a company name is "a rep logging a meeting on the way out of
 * one" - and mailing a client "your appointment is confirmed" about a meeting
 * that finished an hour ago is worse than sending nothing at all.
 */
export function isLive(m: Pick<RepMeeting, 'status' | 'scheduled_at'>, now: Date): boolean {
  if (m.status !== 'planned') return false
  const t = new Date(m.scheduled_at).getTime()
  return Number.isFinite(t) && t > now.getTime()
}

/**
 * Whether a change is one the recipients need to hear about.
 *
 * Deliberately not every edit. A rep adding a line to their own notes, or
 * setting a follow-up date, is doing their filing - it is not news, and mail
 * that arrives for no reason is mail people stop reading.
 *
 * A changed contact_email counts, so the address that ends up on the meeting is
 * the one that gets told about it.
 */
function materialChange(a: RepMeeting, b: RepMeeting): boolean {
  return new Date(a.scheduled_at).getTime() !== new Date(b.scheduled_at).getTime()
    || meetingDuration(a) !== meetingDuration(b)
    || (a.location || '') !== (b.location || '')
    || (a.company || '') !== (b.company || '')
    || (a.contact_email || '') !== (b.contact_email || '')
}

/**
 * What, if anything, to send.
 *
 * `before` is null for a new booking. A meeting that was never live and still
 * is not - written up after the fact, or edited long after it happened - is
 * silence, which is most of what this returns.
 */
export function inviteAction(
  before: RepMeeting | null | undefined,
  after: RepMeeting,
  now: Date,
): InviteAction | null {
  const wasLive = !!before && isLive(before, now)
  const nowLive = isLive(after, now)

  // Includes the case where a meeting nobody was told about is moved into the
  // future: for its recipients that is not a change, it is the first they hear
  // of it.
  if (!wasLive && nowLive) return 'new'
  // Called off. Anything else that stops it being live - marked as happened, or
  // simply now in the past - needs no announcement.
  if (wasLive && !nowLive) return after.status === 'cancelled' ? 'cancelled' : null
  if (wasLive && nowLive) return materialChange(before!, after) ? 'updated' : null
  return null
}

/**
 * A revision number that only ever goes up, without storing one.
 *
 * Calendars ignore an update whose SEQUENCE has not moved, which would leave a
 * rescheduled meeting sitting at its old time in the client's diary while the
 * email said otherwise. Seconds since the row was created is monotonic for as
 * long as the row exists, which is all the property requires.
 */
function sequenceFor(m: RepMeeting): number {
  const created = new Date(m.created_at || 0).getTime()
  const updated = new Date(m.updated_at || m.created_at || 0).getTime()
  if (!Number.isFinite(created) || !Number.isFinite(updated)) return 0
  return Math.max(0, Math.floor((updated - created) / 1000))
}

const HEAD = 'font-family:system-ui,-apple-system,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#111;background:#ffffff'
const BOX = 'background:#f6f7f9;border-radius:12px;padding:18px;margin:0 0 20px'
const ROW = 'margin:0 0 6px;font-size:14px'

/**
 * The details, for the rep and the office - the only two who get this.
 *
 * There was a second version of this block written for the client, back when
 * they were emailed too. Everything in here is internal: who the rep is seeing
 * and how to reach them.
 */
function detailBox(m: RepMeeting): string {
  const venue = (m.location || '').trim()
  const company = (m.company || '').trim()
  const rows: string[] = [
    `<p style="${ROW}"><strong>When:</strong> ${esc(when(m))}</p>`,
    `<p style="${ROW}"><strong>How long:</strong> ${meetingDuration(m)} minutes</p>`,
  ]
  // Only when it says something the company line has not already said.
  if (venue && venue !== company) {
    rows.push(`<p style="${ROW}"><strong>Where:</strong> ${esc(venue)}</p>`)
  }
  rows.push(`<p style="${ROW}"><strong>Company:</strong> ${esc(m.company)}</p>`)
  if (m.contact_name) rows.push(`<p style="${ROW}"><strong>Seeing:</strong> ${esc(m.contact_name)}</p>`)
  if (m.contact_phone) rows.push(`<p style="${ROW}"><strong>Their phone:</strong> ${esc(m.contact_phone)}</p>`)
  return `<div style="${BOX}">${rows.filter(Boolean).join('')}</div>`
}

/** Two buttons for anyone whose mail client will not open the attachment. */
function addToCalendar(m: RepMeeting, organiser: string): string {
  const links = calendarLinks({
    title: m.company,
    start: new Date(m.scheduled_at),
    minutes: meetingDuration(m),
    location: m.location || null,
    details: `Meeting with ${organiser}`,
  })
  if (!links) return ''
  const btn = 'display:inline-block;text-decoration:none;font-weight:600;font-size:14px;padding:11px 18px;border-radius:10px;border:1px solid #d7dae0;color:#111;margin:0 8px 8px 0'
  return `
    <p style="margin:0 0 10px;font-size:13px;color:#666">Add it to your calendar:</p>
    <div style="margin:0 0 20px">
      <a href="${links.google}" style="${btn}">Google Calendar</a>
      <a href="${links.outlook}" style="${btn}">Outlook</a>
      <span style="font-size:13px;color:#999">or open the attached meeting.ics</span>
    </div>
  `
}

function wrap(title: string, lead: string, body: string, foot: string): string {
  return `
    <div style="${HEAD}">
      <h1 style="font-size:21px;margin:0 0 8px">${title}</h1>
      <p style="color:#555;font-size:15px;line-height:1.6;margin:0 0 20px">${lead}</p>
      ${body}
      <p style="color:#999;font-size:13px;line-height:1.6;margin:20px 0 0">${foot}</p>
    </div>
  `
}

export interface NotifyResult {
  action: InviteAction | null
  /** Addresses a message actually went to. */
  sent: string[]
  /** Why nothing went out, when nothing did. */
  skipped?: string
  errors: string[]
}

/**
 * One line for whoever just pressed Save.
 *
 * Names the addresses so a rep can see the client is not among them. Silence
 * when there was nothing to send: a note being edited should not report on the
 * post.
 */
export function describeInvite(r: NotifyResult): string | null {
  if (!r.sent.length) {
    return r.errors.length ? `Saved, but the email did not go out: ${r.errors[0]}` : null
  }
  const verb = r.action === 'cancelled' ? 'Cancellation sent to'
    : r.action === 'updated' ? 'Update sent to'
    : 'Booking sent to'
  const list = r.sent.length === 2 ? `${r.sent[0]} and ${r.sent[1]}` : r.sent.join(', ')
  return `${verb} ${list}${r.errors.length ? ` (${r.errors.length} did not send)` : ''}`
}

/**
 * Email the rep and the client about a meeting that has just been booked,
 * moved or called off.
 *
 * Never throws and never fails the caller. A meeting that saved but could not
 * be emailed about is a meeting that saved; the reverse - losing the booking
 * because Resend was down - would be indefensible. Both routes call this, so
 * booking from the rep's calendar and booking from the admin calendar send the
 * same two emails rather than growing two versions of them.
 */
export async function notifyMeetingChange(
  admin: any,
  opts: {
    meeting: RepMeeting
    /** The row as it was before this write. Null for a new booking. */
    previous?: RepMeeting | null
    /** Set when the row has just been deleted, so there is no state to compare. */
    deleted?: boolean
    now?: Date
  },
): Promise<NotifyResult> {
  const now = opts.now || new Date()
  const m = opts.meeting
  const errors: string[] = []

  try {
    const action: InviteAction | null = opts.deleted
      ? (isLive(m, now) ? 'cancelled' : null)
      : inviteAction(opts.previous, m, now)

    if (!action) {
      return { action: null, sent: [], errors, skipped: 'nothing worth sending' }
    }
    if (!process.env.RESEND_API_KEY) {
      return { action, sent: [], errors, skipped: 'RESEND_API_KEY is not set' }
    }

    // select('*') rather than naming columns, so this cannot come back empty on
    // a database where a column has not landed yet.
    const { data: repRows } = await admin.from('reps').select('*').eq('id', m.rep_id).limit(1)
    const rep = repRows?.[0]
    const repName: string = rep?.name || 'Cardtly'
    const repEmail: string = String(rep?.email || '').trim()
    const clientEmail: string = String(m.contact_email || '').trim()

    const toRep = RECIPIENT_RE.test(repEmail) ? repEmail : null
    // The address on the meeting is NOT written to. It is carried into the mail
    // as a detail so the office can see who the appointment is with.
    const clientShown = RECIPIENT_RE.test(clientEmail) ? clientEmail : null

    // In-house only: the rep, and the office. Nobody outside Cardtly hears about
    // a rep's diary from us - the rep arranges the meeting with the client
    // themselves, and an automated "your meeting is confirmed" arriving from a
    // company they have not agreed to meet yet is not ours to send.
    const recipients = [...new Set([toRep, SUPPORT_EMAIL].filter(Boolean) as string[])]
    if (recipients.length === 0) {
      return { action, sent: [], errors, skipped: 'no usable address on the rep' }
    }

    // PUBLISH, not REQUEST, and no ATTENDEE line. This is a diary entry going to
    // the people who keep the diary, not an invitation anybody is being asked to
    // accept - and an ATTENDEE naming the client is how a mail client decides to
    // send them an RSVP on the organiser's behalf, which is the exact thing this
    // change is here to stop.
    const method = action === 'cancelled' ? 'CANCEL' : 'PUBLISH'
    const common = {
      calendarName: `${repName} - Cardtly`,
      now,
      method: method as 'PUBLISH' | 'CANCEL',
      organizer: toRep ? { name: repName, email: toRep } : null,
      attendees: [],
      sequence: sequenceFor(m),
    }
    const pack = (ics: string) => [{
      filename: 'meeting.ics',
      content: Buffer.from(ics, 'utf8').toString('base64'),
      // Spelled out rather than guessed from the extension: it is the method
      // that makes a mail client offer Accept and Decline.
      contentType: `text/calendar; charset=utf-8; method=${method}`,
    }]
    // One file now, and it may carry the rep's notes and the stage the deal is
    // at, because the only people receiving it work here.
    const attachments = pack(buildIcs([m], common))

    const resend = new Resend(process.env.RESEND_API_KEY)
    const stamp = shortWhen(m)
    const sent: string[] = []

    const send = async (to: string, subject: string, html: string, attachments: any[], replyTo?: string) => {
      try {
        const { error } = await resend.emails.send({
          from: FROM_EMAIL, to, subject, html, attachments,
          ...(replyTo ? { replyTo } : {}),
        })
        if (error) errors.push(`${to}: ${error.message || 'send failed'}`)
        else sent.push(to)
      } catch (e: any) {
        errors.push(`${to}: ${e?.message || 'send failed'}`)
      }
    }

    const who = `${repName}${m.contact_name ? ` with ${m.contact_name}` : ''}`
    const subject =
      action === 'new' ? `Booked: ${m.company}${stamp ? ` on ${stamp}` : ''} - ${repName}`
      : action === 'updated' ? `Moved: ${m.company}${stamp ? ` to ${stamp}` : ''} - ${repName}`
      : `Cancelled: ${m.company}${stamp ? ` on ${stamp}` : ''} - ${repName}`
    const lead =
      action === 'new' ? `${esc(who)} has booked the appointment below. The calendar file is attached.`
      : action === 'updated' ? 'The details changed. The attached file replaces the old one.'
      : 'This one is off. The attachment removes it from the calendar.'
    const body =
      detailBox(m) + (action === 'cancelled' ? '' : addToCalendar(m, repName))
    const foot = clientShown
      ? `The client has NOT been emailed. They are on ${esc(clientShown)} if somebody needs to confirm it with them.`
      : 'The client has not been emailed, and there is no address on this meeting.'

    // Sent one at a time rather than as one message with several recipients, so
    // a bounce on the office address cannot take the rep's copy down with it,
    // and so `sent` reports exactly who got it.
    for (const to of recipients) {
      await send(
        to, subject,
        wrap(action === 'cancelled' ? `${m.company} is cancelled` : m.company, lead, body, foot),
        attachments,
        // A reply goes to the rep, who is the one who can answer it. The office
        // reading this is the commonest reason anybody would reply at all.
        toRep && to !== toRep ? toRep : undefined,
      )
    }

    return { action, sent, errors }
  } catch (e: any) {
    // Anything at all: the meeting is saved and that is what matters.
    errors.push(e?.message || 'invite failed')
    return { action: null, sent: [], errors }
  }
}
