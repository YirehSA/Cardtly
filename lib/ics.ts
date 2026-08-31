// A .ics of a rep's meetings, so the diary they already live in gets them too.
//
// A rep whose appointments only exist inside Cardtly has two calendars and
// trusts neither. This writes RFC 5545 iCalendar, which Google Calendar,
// Outlook and iOS all import, and it folds by the same 75-octet rule as the
// vCard writer (see lib/text-fold).

import { foldLine } from './text-fold'
import {
  meetingDuration, statusMeta, outcomeMeta,
  type RepMeeting,
} from './rep-meetings'

// RFC 5545 escaping: backslash, semicolon and comma are structural, and a
// newline inside a value has to become a literal \n or it terminates the line.
function esc(v: unknown): string {
  return String(v ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/\r\n/g, '\\n')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
    .trim()
}

/** UTC basic format: 20260730T090000Z. Written in UTC so no VTIMEZONE block is
 *  needed and no client has to guess which zone "09:00" meant. */
function stamp(d: Date): string {
  const p = (n: number, w = 2) => String(n).padStart(w, '0')
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}T`
    + `${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`
}

// The rep's own diary entry: everything they wrote down.
function description(m: RepMeeting): string {
  const bits: string[] = []
  if (m.contact_name) bits.push(`Seeing: ${m.contact_name}`)
  if (m.contact_phone) bits.push(`Phone: ${m.contact_phone}`)
  if (m.contact_email) bits.push(`Email: ${m.contact_email}`)
  bits.push(`Status: ${statusMeta(m.status).label}`)
  const outcome = outcomeMeta(m.outcome)
  if (outcome) bits.push(`Outcome: ${outcome.label}`)
  if (m.follow_up_on) bits.push(`Follow up on: ${m.follow_up_on}`)
  if (m.notes) bits.push('', m.notes)
  return bits.join('\n')
}

/**
 * The same event as the person being invited should see it.
 *
 * The description above is a sales rep's private working notes: who they are
 * seeing, what stage it is at, what came of it, and whatever they typed in the
 * notes box. Sending that to the client puts "Outcome: Not interested" and
 * every candid remark about them straight into their calendar, where it stays.
 * They get the appointment, and nothing else.
 */
function attendeeDescription(m: RepMeeting, organizerName?: string | null): string {
  const bits: string[] = []
  if (organizerName) bits.push(`Meeting with ${organizerName}`)
  if (m.location) bits.push(`Where: ${m.location}`)
  return bits.join('\n')
}

function eventStatus(status: string): string {
  // VEVENT allows TENTATIVE, CONFIRMED and CANCELLED only. A no-show still
  // happened as far as the diary is concerned - it is the outcome that was bad.
  return status === 'cancelled' ? 'CANCELLED' : 'CONFIRMED'
}

/** Somebody on the invitation. */
export interface IcsPerson {
  name?: string | null
  email: string
}

// A parameter value, not a property value, so the rules are different: it goes
// in double quotes and therefore may not contain one, and a newline would end
// the line. Backslash-escaping does not apply here, so the characters are
// removed rather than escaped.
function param(v: string): string {
  return `"${String(v).replace(/["\\]/g, '').replace(/[\r\n]+/g, ' ').trim()}"`
}

function person(prop: string, p: IcsPerson, extra = ''): string {
  const cn = p.name ? `;CN=${param(p.name)}` : ''
  return `${prop}${cn}${extra}:mailto:${p.email.trim()}`
}

export function buildIcs(
  meetings: RepMeeting[],
  opts: {
    calendarName: string
    now?: Date
    /**
     * PUBLISH is a diary you are handing someone a copy of. REQUEST is an
     * invitation their calendar will offer to accept, and CANCEL withdraws one.
     * The difference is what makes an email attachment show up as "Anthony has
     * invited you" rather than as a file.
     */
    method?: 'PUBLISH' | 'REQUEST' | 'CANCEL'
    organizer?: IcsPerson | null
    attendees?: IcsPerson[]
    /**
     * Bumped on every change to the same UID. A client that has already seen
     * this event ignores a revision whose sequence has not moved, so without
     * this a rescheduled meeting silently stays at the old time in their diary.
     */
    sequence?: number
    /**
     * Who is going to read it. 'attendee' strips the rep's notes, the stage the
     * deal is at and what came of it - see attendeeDescription. Defaults to the
     * rep, so the diary download is unchanged.
     */
    audience?: 'organiser' | 'attendee'
  },
): string {
  const now = opts.now || new Date()
  const method = opts.method || 'PUBLISH'
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Cardtly//Rep meetings//EN',
    'CALSCALE:GREGORIAN',
    `METHOD:${method}`,
    `X-WR-CALNAME:${esc(opts.calendarName)}`,
  ]

  for (const m of meetings) {
    const start = new Date(m.scheduled_at)
    // A row with an unparseable date would produce DTSTART:NaN and make the
    // whole file unimportable, taking every other meeting with it.
    if (!Number.isFinite(start.getTime())) continue
    const end = new Date(start.getTime() + meetingDuration(m) * 60_000)

    lines.push(
      'BEGIN:VEVENT',
      `UID:${m.id}@cardtly.com`,
      `DTSTAMP:${stamp(now)}`,
      `DTSTART:${stamp(start)}`,
      `DTEND:${stamp(end)}`,
      `SUMMARY:${esc(m.company)}`,
      `DESCRIPTION:${esc(
        opts.audience === 'attendee'
          ? attendeeDescription(m, opts.organizer?.name)
          : description(m)
      )}`,
      // A withdrawal is CANCELLED whatever the row still says. The status
      // column is the rep's record of the appointment; METHOD:CANCEL is what
      // the recipient's calendar is being told to do with it.
      `STATUS:${method === 'CANCEL' ? 'CANCELLED' : eventStatus(m.status)}`,
      `SEQUENCE:${Math.max(0, Math.floor(opts.sequence ?? 0))}`,
      `LAST-MODIFIED:${stamp(new Date(m.updated_at || m.created_at || now))}`,
    )
    if (m.location) lines.push(`LOCATION:${esc(m.location)}`)
    if (opts.organizer?.email) lines.push(person('ORGANIZER', opts.organizer))
    for (const a of opts.attendees || []) {
      if (!a.email) continue
      lines.push(person('ATTENDEE', a, ';ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE'))
    }

    // Half an hour's warning, on things that have not happened yet. No point
    // reminding anyone about a meeting already written up, or about one being
    // called off.
    if (method !== 'CANCEL' && m.status === 'planned' && end.getTime() > now.getTime()) {
      lines.push(
        'BEGIN:VALARM',
        'ACTION:DISPLAY',
        `DESCRIPTION:${esc(m.company)}`,
        'TRIGGER:-PT30M',
        'END:VALARM',
      )
    }
    lines.push('END:VEVENT')
  }

  lines.push('END:VCALENDAR')
  return lines.map(foldLine).join('\r\n') + '\r\n'
}
