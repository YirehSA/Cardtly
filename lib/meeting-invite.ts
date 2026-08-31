import { Resend } from 'resend'
import { FROM_EMAIL } from './email'
import { buildIcs } from './ics'
import { meetingDuration, type RepMeeting } from './rep-meetings'

// Telling the two people in the room that a meeting exists.
//
// A rep booking an appointment used to write it into their own calendar and
// nothing else happened: the client was told over the phone, or not at all, and
// the rep's real diary - the one on their phone with the alarm in it - never
// heard about it either. Both now get an email carrying a proper invitation, so
// the appointment lands in whichever calendar each of them actually lives in.
//
// Attached as METHOD:REQUEST rather than a plain file, which is the difference
// between "Anthony has invited you" with an Accept button and an .ics somebody
// has to know what to do with. See lib/ics.

const RECIPIENT_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

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

function detailBox(m: RepMeeting, extra: { rep?: string } = {}): string {
  const rows = [
    `<p style="${ROW}"><strong>When:</strong> ${esc(when(m))}</p>`,
    `<p style="${ROW}"><strong>How long:</strong> ${meetingDuration(m)} minutes</p>`,
    m.location ? `<p style="${ROW}"><strong>Where:</strong> ${esc(m.location)}</p>` : '',
    `<p style="${ROW}"><strong>Company:</strong> ${esc(m.company)}</p>`,
    extra.rep ? `<p style="${ROW}"><strong>Cardtly:</strong> ${esc(extra.rep)}</p>` : '',
    m.contact_name ? `<p style="${ROW}"><strong>Contact:</strong> ${esc(m.contact_name)}</p>` : '',
    m.contact_phone ? `<p style="${ROW}"><strong>Phone:</strong> ${esc(m.contact_phone)}</p>` : '',
  ]
  return `<div style="${BOX}">${rows.filter(Boolean).join('')}</div>`
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
 * A rep needs to know whether their client was told, because the alternative is
 * assuming they were and finding out at the meeting. Silence when there was
 * nothing to send: a note being edited should not report on the post.
 */
export function describeInvite(r: NotifyResult): string | null {
  if (!r.sent.length) {
    return r.errors.length ? `Saved, but the email did not go out: ${r.errors[0]}` : null
  }
  const verb = r.action === 'cancelled' ? 'Cancellation sent to'
    : r.action === 'updated' ? 'Update sent to'
    : 'Invitation sent to'
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
    const toClient = RECIPIENT_RE.test(clientEmail) ? clientEmail : null
    if (!toRep && !toClient) {
      return { action, sent: [], errors, skipped: 'no usable address on the rep or the meeting' }
    }

    const organizer = toRep ? { name: repName, email: toRep } : null
    const attendees = toClient
      ? [{ name: m.contact_name || null, email: toClient }]
      : []
    const ics = buildIcs([m], {
      calendarName: `${repName} - Cardtly`,
      now,
      method: action === 'cancelled' ? 'CANCEL' : 'REQUEST',
      organizer,
      attendees,
      sequence: sequenceFor(m),
    })
    const attachments = [{
      filename: 'meeting.ics',
      content: Buffer.from(ics, 'utf8').toString('base64'),
      // Spelled out rather than guessed from the extension: it is the method
      // that makes a mail client offer Accept and Decline.
      contentType: `text/calendar; charset=utf-8; method=${action === 'cancelled' ? 'CANCEL' : 'REQUEST'}`,
    }]

    const resend = new Resend(process.env.RESEND_API_KEY)
    const stamp = shortWhen(m)
    const sent: string[] = []

    const send = async (to: string, subject: string, html: string, replyTo?: string) => {
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

    if (toRep) {
      const subject =
        action === 'new' ? `Booked: ${m.company}${stamp ? ` on ${stamp}` : ''}`
        : action === 'updated' ? `Moved: ${m.company}${stamp ? ` to ${stamp}` : ''}`
        : `Cancelled: ${m.company}${stamp ? ` on ${stamp}` : ''}`
      const lead =
        action === 'new' ? 'This is in your diary. The calendar invitation is attached.'
        : action === 'updated' ? 'The details changed. The attached invitation replaces the old one.'
        : 'This one is off. The attachment removes it from your calendar.'
      await send(
        toRep, subject,
        wrap(
          action === 'cancelled' ? `${m.company} is cancelled` : `${m.company}`,
          lead,
          detailBox(m),
          toClient
            ? `${esc(toClient)} was told as well.`
            : 'No email address on this meeting, so nobody else was told.',
        ),
        // A reply goes to the person they are seeing, which is the only reply
        // worth making to this.
        toClient || undefined,
      )
    }

    if (toClient) {
      const first = String(m.contact_name || '').trim().split(/\s+/)[0]
      const hello = first ? `Hi ${esc(first)},` : 'Hi,'
      const subject =
        action === 'new' ? `Your meeting with ${repName}${stamp ? ` on ${stamp}` : ''}`
        : action === 'updated' ? `Your meeting with ${repName} has moved${stamp ? ` to ${stamp}` : ''}`
        : `Your meeting with ${repName}${stamp ? ` on ${stamp}` : ''} is cancelled`
      const lead =
        action === 'new'
          ? `${hello} ${esc(repName)} from Cardtly has booked the time below with you. Add it to your calendar with the attachment, and just reply here if it does not suit.`
          : action === 'updated'
          ? `${hello} the meeting with ${esc(repName)} from Cardtly has changed. The new details are below, and the attachment updates your calendar.`
          : `${hello} the meeting with ${esc(repName)} from Cardtly has been cancelled. Nothing is needed from you.`
      await send(
        toClient, subject,
        wrap(
          action === 'cancelled' ? 'Meeting cancelled' : 'Meeting confirmed',
          lead,
          detailBox(m, { rep: repName }),
          'Sent by Cardtly on behalf of the sender. Reply to this email to reach them.',
        ),
        toRep || undefined,
      )
    }

    return { action, sent, errors }
  } catch (e: any) {
    // Anything at all: the meeting is saved and that is what matters.
    errors.push(e?.message || 'invite failed')
    return { action: null, sent: [], errors }
  }
}
