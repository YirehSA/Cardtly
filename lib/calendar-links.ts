// "Add to calendar" links, for the people an .ics attachment does not reach.
//
// An attached invitation is the right thing to send: Apple Mail, Outlook and
// most of Gmail offer to add it, and a rescheduled meeting can update the one
// already in their diary because it carries the same UID.
//
// But it only works if their mail client cooperates, and plenty do not - a
// webmail that shows meeting.ics as a file to download, a phone that opens it
// in a text viewer, a client who forwards the mail to a colleague whose client
// strips attachments. These links need nothing but a browser, and between the
// two of them they cover almost everybody who could not use the attachment.

/** Compact UTC form, which is what both of these want: 20260902T070000Z */
function stamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}T`
    + `${p(d.getUTCHours())}${p(d.getUTCMinutes())}00Z`
}

export interface CalendarEvent {
  title: string
  start: Date
  minutes: number
  location?: string | null
  details?: string | null
}

function endOf(e: CalendarEvent): Date {
  return new Date(e.start.getTime() + Math.max(5, e.minutes || 60) * 60_000)
}

export function googleCalendarUrl(e: CalendarEvent): string {
  const q = new URLSearchParams({
    action: 'TEMPLATE',
    text: e.title,
    dates: `${stamp(e.start)}/${stamp(endOf(e))}`,
  })
  if (e.location) q.set('location', e.location)
  if (e.details) q.set('details', e.details)
  return `https://calendar.google.com/calendar/render?${q.toString()}`
}

export function outlookCalendarUrl(e: CalendarEvent): string {
  // Outlook wants ISO with the offset, not the compact form Google takes.
  const q = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: e.title,
    startdt: e.start.toISOString(),
    enddt: endOf(e).toISOString(),
  })
  if (e.location) q.set('location', e.location)
  if (e.details) q.set('body', e.details)
  return `https://outlook.live.com/calendar/0/deeplink/compose?${q.toString()}`
}

/** Both, or neither if the date cannot be read. */
export function calendarLinks(e: CalendarEvent): { google: string; outlook: string } | null {
  if (!Number.isFinite(e.start.getTime())) return null
  return { google: googleCalendarUrl(e), outlook: outlookCalendarUrl(e) }
}
