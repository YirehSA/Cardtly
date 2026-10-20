// The date and time on a meeting request: checking what the visitor sent, and
// writing it out for people.
//
// The form used to send whatever the browser's own date and time boxes held.
// The time box refused half-typed times with "invalid value" and could not
// reach every time on some phones, so the form now offers an hour and a minute
// from lists, and the server checks the shape of both before it emails anyone.
// The emails printed the date as 2026-10-20; they now say Tuesday 20 October
// 2026. Written out by hand rather than with toLocaleDateString, so the words
// do not depend on which locale data the server happens to have.
//
// scripts/check-booking-request.mjs runs these.

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

/** The minutes the form offers. Every hour of the day is offered. */
export const BOOKING_MINUTES = ['00', '15', '30', '45'] as const

/** A real calendar date written YYYY-MM-DD, or null. */
export function parseIsoDate(v: unknown): { y: number; m: number; d: number } | null {
  const s = String(v ?? '').trim()
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (!m) return null
  const y = +m[1], mo = +m[2], d = +m[3]
  const t = new Date(Date.UTC(y, mo - 1, d))
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== mo - 1 || t.getUTCDate() !== d) return null
  return { y, m: mo, d }
}

/** A 24-hour time written HH:MM, or null. Empty means "any time" and is allowed by the caller. */
export function parseHHMM(v: unknown): string | null {
  const s = String(v ?? '').trim()
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(s)
  return m ? `${m[1]}:${m[2]}` : null
}

/** An IANA time zone name such as Africa/Johannesburg, or null. Only ever shown, never used to compute. */
export function cleanTimeZone(v: unknown): string | null {
  const s = String(v ?? '').trim()
  return s.length <= 64 && /^[A-Za-z][A-Za-z0-9_+-]*(\/[A-Za-z0-9_+-]+){0,2}$/.test(s) ? s : null
}

/** "Tuesday 20 October 2026". */
export function formatBookingDate(iso: string): string {
  const p = parseIsoDate(iso)
  if (!p) return String(iso ?? '')
  const wd = new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay()
  return `${WEEKDAYS[wd]} ${p.d} ${MONTHS[p.m - 1]} ${p.y}`
}

/** "Tue 20 Oct", for a subject line. */
export function formatBookingDateShort(iso: string): string {
  const p = parseIsoDate(iso)
  if (!p) return String(iso ?? '')
  const wd = new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay()
  return `${WEEKDAYS[wd].slice(0, 3)} ${p.d} ${MONTHS[p.m - 1].slice(0, 3)}`
}

/**
 * The time as the visitor meant it. Their own clock, so the zone is named
 * when we know it: a visitor in London asking for 09:00 is not asking for
 * 09:00 in Johannesburg.
 */
export function formatBookingTime(hhmm: string | null | undefined, timeZone?: string | null): string {
  if (!hhmm) return 'Any time'
  if (!timeZone) return hhmm
  if (timeZone === 'Africa/Johannesburg') return `${hhmm} (South African time)`
  return `${hhmm} (${timeZone.replace(/_/g, ' ')} time)`
}

/** When the request was sent, in South African time: "20 October 2026, 14:05". */
export function formatSentAt(at: Date): string {
  const sast = new Date(at.getTime() + 2 * 3600 * 1000)
  const hh = String(sast.getUTCHours()).padStart(2, '0')
  const mm = String(sast.getUTCMinutes()).padStart(2, '0')
  return `${sast.getUTCDate()} ${MONTHS[sast.getUTCMonth()]} ${sast.getUTCFullYear()}, ${hh}:${mm}`
}

/**
 * Refuse a date that is plainly in the past. A day of slack, because the
 * visitor's "today" can be the server's yesterday on the other side of the
 * world.
 */
export function isPastDate(iso: string, now: Date = new Date()): boolean {
  const p = parseIsoDate(iso)
  if (!p) return true
  return Date.UTC(p.y, p.m - 1, p.d) < Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - 86400000
}
