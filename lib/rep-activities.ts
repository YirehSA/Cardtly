import { startOfDay, startOfWeek, startOfMonth, addDays, addMonths } from './calendar'

// A rep's outreach log: the vocabulary, the sums and the filters.
//
// Same division as rep-calls.ts - the words and the arithmetic live here, away
// from React and away from the database, so a stat card and an exported CSV
// cannot disagree about what a response rate is.

/**
 * Two colours per kind, and the second one is not decoration.
 *
 * `colour` is the hue: right for an icon, a border, a tint, a big number. Put
 * white text on it and #0ea5e9 comes out at 2.8:1, which is a label nobody can
 * read on the loudest button on the page. `solid` is the same hue taken down
 * far enough to carry white at 5.9:1 or better, and it is the only one a
 * filled button may use.
 */
export const ACTIVITY_KINDS = [
  { id: 'email',      label: 'Email log',  short: 'Email',      colour: '#3b82f6', solid: '#1d4ed8', starts: 'email_sent' },
  { id: 'linkedin',   label: 'LinkedIn',   short: 'LinkedIn',   colour: '#0ea5e9', solid: '#0369a1', starts: 'request_sent' },
  { id: 'networking', label: 'Networking', short: 'Networking', colour: '#a855f7', solid: '#7e22ce', starts: 'attended' },
] as const

export type ActivityKind = (typeof ACTIVITY_KINDS)[number]['id']

export function isActivityKind(v: unknown): v is ActivityKind {
  return ACTIVITY_KINDS.some(k => k.id === v)
}

export function kindMeta(id: string) {
  return ACTIVITY_KINDS.find(k => k.id === id) || ACTIVITY_KINDS[0]
}

/**
 * What came of it.
 *
 * Each status names the kinds it belongs to, so the form offers four choices
 * for an email rather than eleven. `meeting_booked` belongs to all three,
 * because the point of every one of them is to end up in a room.
 *
 * `answered` distinguishes "they wrote back" from "it went out", which is the
 * only pair of facts a response rate can be built from. `positive` is narrower:
 * a bounce is not a reply and "not interested" is a reply but not a win, and a
 * card that counted either as progress would be flattering the rep.
 */
export const ACTIVITY_STATUSES = [
  { id: 'email_sent',     label: 'Email sent',     colour: '#3b82f6', kinds: ['email'],                              answered: false, positive: false },
  { id: 'replied',        label: 'Replied',        colour: '#22c55e', kinds: ['email', 'linkedin'],                  answered: true,  positive: true },
  { id: 'not_interested', label: 'Not interested', colour: '#ef4444', kinds: ['email', 'linkedin', 'networking'],    answered: true,  positive: false },
  { id: 'bounced',        label: 'Bounced',        colour: '#f59e0b', kinds: ['email'],                              answered: false, positive: false },

  { id: 'request_sent',   label: 'Request sent',   colour: '#64748b', kinds: ['linkedin'],                           answered: false, positive: false },
  { id: 'connected',      label: 'Connected',      colour: '#22c55e', kinds: ['linkedin'],                           answered: true,  positive: true },
  { id: 'message_sent',   label: 'Message sent',   colour: '#0ea5e9', kinds: ['linkedin'],                           answered: false, positive: false },

  { id: 'attended',       label: 'Attended',       colour: '#a855f7', kinds: ['networking'],                         answered: false, positive: false },
  { id: 'met_contacts',   label: 'Met contacts',   colour: '#22c55e', kinds: ['networking'],                         answered: true,  positive: true },

  { id: 'meeting_booked', label: 'Meeting booked', colour: '#7c3aed', kinds: ['email', 'linkedin', 'networking'],    answered: true,  positive: true },
] as const

export type ActivityStatus = (typeof ACTIVITY_STATUSES)[number]['id']

export function isActivityStatus(v: unknown): v is ActivityStatus {
  return ACTIVITY_STATUSES.some(s => s.id === v)
}

export function statusMeta(id: string) {
  return ACTIVITY_STATUSES.find(s => s.id === id) || ACTIVITY_STATUSES[0]
}

/** The statuses a given kind may carry. The form and the API both read this,
 *  so what is offered and what is accepted cannot drift apart. */
export function statusesFor(kind: ActivityKind) {
  return ACTIVITY_STATUSES.filter(s => (s.kinds as readonly string[]).includes(kind))
}

export function statusFitsKind(status: string, kind: ActivityKind): boolean {
  return statusesFor(kind).some(s => s.id === status)
}

/**
 * What a kind opens on.
 *
 * Declared per kind rather than taken as the first match, which is how logging
 * a networking evening used to open on "Not interested" and LinkedIn on
 * "Replied": both are shared statuses that happen to sit early in the list, and
 * a form pre-filled with the wrong answer is worse than one left blank, because
 * somebody will save it.
 */
export function defaultStatusFor(kind: ActivityKind): ActivityStatus {
  return kindMeta(kind).starts as ActivityStatus
}

/**
 * The status to hold after switching kind.
 *
 * Switching from Email to Networking with "Bounced" selected would post
 * something the API refuses, so it moves. But only when it has to: both
 * Email and LinkedIn can end in "Meeting booked", and silently throwing that
 * answer away because the kind changed would lose the most important fact on
 * the form. Lives here rather than in the form so it can be tested without a
 * browser.
 */
export function nextStatusForKind(current: string, kind: ActivityKind): ActivityStatus {
  return statusFitsKind(current, kind) ? (current as ActivityStatus) : defaultStatusFor(kind)
}

export interface RepActivity {
  id: string
  rep_id: string
  kind: ActivityKind
  company: string
  contact_name: string | null
  email: string | null
  subject: string | null
  happened_at: string
  status: ActivityStatus
  next_step: string | null
  follow_up_on: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

/** repName is set only where more than one rep is on screen, which is admin. */
export interface LoggedActivity extends RepActivity {
  repName?: string | null
}

// ── The numbers on the cards ────────────────────────────────────────────────

export interface ActivitySummary {
  emailsSent: number
  positive: number
  /** Replies over emails sent, as a percentage. */
  responseRate: number | null
  connections: number
  meetings: number
  total: number
}

/**
 * The four figures at the top of the page.
 *
 * Calls come in as well, because "meetings booked" that ignored the phone would
 * be a smaller number than the truth and the rep would stop trusting the card.
 * Nothing else here counts calls: they have their own summary on their own tab.
 */
export function summariseActivities(
  activities: RepActivity[],
  calls: RepCallLike[] = [],
): ActivitySummary {
  const emails = activities.filter(a => a.kind === 'email')
  const answered = emails.filter(a => statusMeta(a.status).answered).length

  return {
    emailsSent: emails.length,
    positive: emails.filter(a => statusMeta(a.status).positive).length,
    // Null rather than 0 when nothing has gone out. "0% response" against no
    // emails is a lie about effort, and the card says "-" instead.
    responseRate: emails.length === 0 ? null : Math.round((answered / emails.length) * 100),
    connections: activities.filter(a => a.status === 'connected').length,
    meetings:
      activities.filter(a => a.status === 'meeting_booked').length
      + calls.filter(c => c.outcome === 'meeting_booked').length,
    total: activities.length,
  }
}

type RepCallLike = { outcome: string }

// ── Windows and filters ────────────────────────────────────────────────────

/**
 * The window a period covers.
 *
 * The same rule as callRange, and for the same reason: a filter labelled
 * September must not quietly include the 31st of August because a month grid
 * happens to be drawn that way.
 */
export function activityRange(
  period: 'day' | 'week' | 'month' | 'list',
  anchor: Date,
): { from: Date; to: Date } | null {
  if (period === 'list') return null
  if (period === 'day') {
    const from = startOfDay(anchor)
    return { from, to: addDays(from, 1) }
  }
  if (period === 'week') {
    const from = startOfWeek(anchor)
    return { from, to: addDays(from, 7) }
  }
  const from = startOfMonth(anchor)
  return { from, to: addMonths(from, 1) }
}

/** Half open, so an activity logged at midnight lands in exactly one day. */
export function withinRange<T extends { happened_at: string }>(rows: T[], from: Date, to: Date): T[] {
  const a = from.getTime(), b = to.getTime()
  return rows.filter(r => {
    const t = new Date(r.happened_at).getTime()
    return Number.isFinite(t) && t >= a && t < b
  })
}

/** Words match in any order and across fields, so "growthpoint tenant" finds
 *  the row whether the rep typed the company or the subject first. */
export function filterActivities(
  rows: LoggedActivity[],
  search: string,
  kind: ActivityKind | null,
  status: ActivityStatus | null,
): LoggedActivity[] {
  const words = search.toLowerCase().split(/\s+/).filter(Boolean)
  return rows.filter(r => {
    if (kind && r.kind !== kind) return false
    if (status && r.status !== status) return false
    if (words.length === 0) return true
    const hay = [r.company, r.contact_name, r.email, r.subject, r.notes, r.next_step, r.repName]
      .filter(Boolean).join(' ').toLowerCase()
    return words.every(w => hay.includes(w))
  })
}

/** yyyy-mm-dd in the viewer's own timezone, which is what a date column holds. */
export function dayKey(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/**
 * Outreach that is owed a follow-up.
 *
 * Due today counts as due, the same as callbacks: a rep opening this at 09:00
 * to see who to chase should not have to know that today's list appears
 * tomorrow. Anything already booked or turned down is finished business and
 * drops off, however the date reads.
 */
export function dueFollowUps(rows: RepActivity[], today: Date): RepActivity[] {
  const key = dayKey(today)
  return rows
    .filter(r => r.status !== 'meeting_booked' && r.status !== 'not_interested')
    .filter(r => r.follow_up_on && r.follow_up_on <= key)
    .sort((a, b) => (a.follow_up_on || '').localeCompare(b.follow_up_on || ''))
}

// ── The merged feed ────────────────────────────────────────────────────────

/**
 * The log as a CSV a spreadsheet will open correctly.
 *
 * Every field is quoted and every quote inside one is doubled. A company called
 * O'Brien, Smith & Co is not exotic, and one unescaped comma silently shifts
 * every column after it by one - which nobody notices until a report is wrong.
 *
 * CRLF line endings, because that is what Excel expects and a bare \n turns a
 * whole export into one row for some of the people who will open it.
 */
export function activitiesToCsv(rows: LoggedActivity[]): string {
  const cell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const head = [
    'Date', 'Time', 'Type', 'Company', 'Contact', 'Email',
    'Subject', 'Status', 'Next step', 'Follow up on', 'Notes',
  ]
  const lines = rows.map(r => {
    const d = new Date(r.happened_at)
    const ok = Number.isFinite(d.getTime())
    return [
      ok ? dayKey(d) : '',
      ok ? d.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', hour12: false }) : '',
      kindMeta(r.kind).short,
      r.company, r.contact_name, r.email,
      r.subject, statusMeta(r.status).label, r.next_step, r.follow_up_on, r.notes,
    ].map(cell).join(',')
  })
  return [head.map(cell).join(','), ...lines].join('\r\n')
}
