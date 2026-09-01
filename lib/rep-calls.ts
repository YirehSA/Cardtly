// A rep's call log: the fixed vocabulary, in one place.
//
// Meetings split status ("did it happen") from outcome ("what came of it"),
// because you can sit through a meeting and get nothing. A call does not need
// that: it either connected or it did not, and both of those ARE the outcome.
// One column, eight values, no pair of dropdowns to keep consistent.

export const CALL_OUTCOMES = [
  { id: 'answered',       label: 'Spoke to them',  colour: '#22c55e', reached: true },
  { id: 'meeting_booked', label: 'Meeting booked', colour: '#7c3aed', reached: true },
  { id: 'signed',         label: 'Signed up',      colour: '#059669', reached: true },
  { id: 'callback',       label: 'Call back',      colour: '#0ea5e9', reached: true },
  { id: 'not_interested', label: 'Not interested', colour: '#ef4444', reached: true },
  { id: 'voicemail',      label: 'Left a message', colour: '#f59e0b', reached: false },
  { id: 'no_answer',      label: 'No answer',      colour: '#94a3b8', reached: false },
  { id: 'wrong_number',   label: 'Wrong number',   colour: '#64748b', reached: false },
] as const

export type CallOutcome = (typeof CALL_OUTCOMES)[number]['id']

export function isCallOutcome(v: unknown): v is CallOutcome {
  return CALL_OUTCOMES.some(o => o.id === v)
}

export function callOutcomeMeta(id: string) {
  return CALL_OUTCOMES.find(o => o.id === id) || CALL_OUTCOMES[0]
}

/** Did anybody actually pick up. The one number a rep is measured on that is
 *  not a guess: dials are effort, conversations are progress. */
export function reached(c: Pick<RepCall, 'outcome'>): boolean {
  return callOutcomeMeta(c.outcome).reached
}

export interface RepCall {
  id: string
  rep_id: string
  company: string
  contact_name: string | null
  phone: string | null
  called_at: string
  outcome: CallOutcome
  follow_up_on: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

/** A call as a list sees it. repName is set only where more than one rep is on
 *  screen at once, which is the admin view. */
export interface LoggedCall extends RepCall {
  repName?: string | null
}

/** What a day, or a filtered list, adds up to. */
export interface CallSummary {
  total: number
  reached: number
  meetings: number
  signed: number
  callbacks: number
  /** Conversations per dial, as a percentage. Null rather than 0 when nothing
   *  has been dialled: "0% connected" out of no calls is a lie about effort. */
  connectRate: number | null
}

export function summariseCalls(calls: RepCall[]): CallSummary {
  const total = calls.length
  const got = calls.filter(reached).length
  return {
    total,
    reached: got,
    meetings: calls.filter(c => c.outcome === 'meeting_booked').length,
    signed: calls.filter(c => c.outcome === 'signed').length,
    callbacks: calls.filter(c => c.outcome === 'callback').length,
    connectRate: total === 0 ? null : Math.round((got / total) * 100),
  }
}

/**
 * Calls that are owed a call back.
 *
 * Due today counts as due. A rep opening this at 09:00 to see who to ring
 * should not have to remember that today's list only appears tomorrow.
 */
export function dueCallbacks(calls: RepCall[], today: Date): RepCall[] {
  const key = dayKey(today)
  return calls
    .filter(c => c.follow_up_on && c.follow_up_on <= key)
    .sort((a, b) => (a.follow_up_on || '').localeCompare(b.follow_up_on || ''))
}

/** yyyy-mm-dd in the viewer's own timezone, which is what a date column holds. */
export function dayKey(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/**
 * Narrow a log by text and outcome.
 *
 * Words match in any order and across fields, so "sicon shaun" finds the call
 * whether the rep typed the company or the person first.
 */
export function filterCalls(
  calls: LoggedCall[],
  search: string,
  outcome: CallOutcome | null,
): LoggedCall[] {
  const words = search.toLowerCase().split(/\s+/).filter(Boolean)
  return calls.filter(c => {
    if (outcome && c.outcome !== outcome) return false
    if (words.length === 0) return true
    const hay = [c.company, c.contact_name, c.phone, c.notes, c.repName]
      .filter(Boolean).join(' ').toLowerCase()
    return words.every(w => hay.includes(w))
  })
}
