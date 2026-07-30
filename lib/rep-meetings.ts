// Rep meetings: the fixed vocabulary, in one place.
//
// Status and outcome are separate on purpose. Status is what happened to the
// appointment - did it take place. Outcome is what came of it. Collapsing them
// into one list is how you end up unable to answer "how many meetings did we
// actually sit through" separately from "how many closed", because "no show"
// and "not interested" would live in the same column.

export const MEETING_STATUSES = [
  { id: 'planned',   label: 'Planned',   colour: '#0ea5e9', done: false },
  { id: 'done',      label: 'Happened',  colour: '#22c55e', done: true },
  { id: 'no_show',   label: 'No show',   colour: '#f59e0b', done: true },
  { id: 'cancelled', label: 'Cancelled', colour: '#94a3b8', done: true },
] as const

export type MeetingStatus = (typeof MEETING_STATUSES)[number]['id']

// Only meaningful once a meeting has happened. A planned meeting has no
// outcome yet, which is why this is nullable rather than having a "pending"
// member - a pending outcome is just an absent one.
export const MEETING_OUTCOMES = [
  { id: 'signed',         label: 'Signed up',     colour: '#22c55e' },
  { id: 'trial',          label: 'Took a trial',  colour: '#a855f7' },
  { id: 'follow_up',      label: 'Needs follow-up', colour: '#0ea5e9' },
  { id: 'not_interested', label: 'Not interested', colour: '#ef4444' },
] as const

export type MeetingOutcome = (typeof MEETING_OUTCOMES)[number]['id']

export function isMeetingStatus(v: unknown): v is MeetingStatus {
  return MEETING_STATUSES.some(s => s.id === v)
}

export function isMeetingOutcome(v: unknown): v is MeetingOutcome {
  return MEETING_OUTCOMES.some(o => o.id === v)
}

export function statusMeta(id: string) {
  return MEETING_STATUSES.find(s => s.id === id) || MEETING_STATUSES[0]
}

export function outcomeMeta(id: string | null | undefined) {
  return id ? MEETING_OUTCOMES.find(o => o.id === id) || null : null
}

export interface RepMeeting {
  id: string
  rep_id: string
  company: string
  contact_name: string | null
  contact_phone: string | null
  contact_email: string | null
  scheduled_at: string
  status: MeetingStatus
  outcome: MeetingOutcome | null
  notes: string | null
  created_at: string
  updated_at: string
  /** These three arrive with migration 048, which is applied by hand after the
   *  deploy. Optional rather than required so every reader has to go through the
   *  helpers below and cope with them being absent, instead of rendering a
   *  calendar full of undefined. */
  duration_minutes?: number | null
  location?: string | null
  follow_up_on?: string | null
}

/** A meeting as the calendar sees it. repName is set only where more than one
 *  rep is on screen at once, which is the admin view. */
export interface CalendarMeeting extends RepMeeting {
  repName?: string | null
}

/** An hour. Long enough to be a real appointment, short enough that back to
 *  back bookings do not overlap by default. */
export const DEFAULT_DURATION_MINUTES = 60

export const DURATION_CHOICES = [15, 30, 45, 60, 90, 120, 180, 240] as const

export function meetingDuration(m: Pick<RepMeeting, 'duration_minutes'>): number {
  const d = Number(m.duration_minutes)
  // Before migration 048 the column does not exist, so every meeting is an
  // hour. Also catches a 0 or a NULL, which would draw a block with no height.
  return Number.isFinite(d) && d > 0 ? d : DEFAULT_DURATION_MINUTES
}

export function meetingStart(m: Pick<RepMeeting, 'scheduled_at'>): Date {
  return new Date(m.scheduled_at)
}

export function meetingEnd(m: Pick<RepMeeting, 'scheduled_at' | 'duration_minutes'>): Date {
  return new Date(new Date(m.scheduled_at).getTime() + meetingDuration(m) * 60_000)
}
