// How a team is billed. Shared by the admin API and the admin UI so the two
// cannot drift (the NFC statuses used to be duplicated in exactly that way).
//
// This column decides whether a team appears as money coming in, so it is
// worth being explicit: three of the four live teams are Cardtly's own or
// deliberately free, and defaulting everything to 'monthly' is what made the
// dashboard report R6,499 of revenue that will never be collected.

export const ORG_BILLING_MODES = ['monthly', 'yearly', 'debit_order', 'comp', 'trial'] as const
export type OrgBillingMode = (typeof ORG_BILLING_MODES)[number]

export const MAX_SELF_SERVE_SEATS = 20
export const SEAT_PRICE_RAND = 97

export const BILLING_MODE_META: Record<OrgBillingMode, {
  label: string
  short: string
  colour: string
  desc: string
  isRevenue: boolean
}> = {
  monthly: {
    label: 'Paystack monthly',
    short: 'Monthly',
    colour: '#22c55e',
    desc: `Self-serve. Paystack collects R${SEAT_PRICE_RAND} per seat every month. Up to ${MAX_SELF_SERVE_SEATS} seats.`,
    isRevenue: true,
  },
  yearly: {
    label: 'Paystack yearly',
    short: 'Yearly',
    colour: '#22c55e',
    desc: `Self-serve, billed annually. Up to ${MAX_SELF_SERVE_SEATS} seats.`,
    isRevenue: true,
  },
  debit_order: {
    label: 'Debit order (Enterprise)',
    short: 'Debit order',
    colour: '#f59e0b',
    desc: 'Enterprise. Invoiced and collected outside Paystack. Real revenue, but nothing collects it automatically: you do. Set a start date to give them a free run first.',
    isRevenue: true,
  },
  comp: {
    label: 'Comped (free forever)',
    short: 'Comped',
    colour: '#0ea5e9',
    desc: 'Never billed, never counted as revenue. For our own teams and partners.',
    isRevenue: false,
  },
  trial: {
    label: 'Trial (free until a date)',
    short: 'Trial',
    colour: '#a855f7',
    desc: 'Free until the end date, then you convert them. Nothing is billed and nothing goes offline when it lapses: it flags in admin and you decide.',
    isRevenue: false,
  },
}

// Days until a team trial ends. Negative means it already lapsed. Null when
// the team is not on a trial, or has no date.
export function orgTrialDaysLeft(mode: string | null, trialEndsAt: string | null): number | null {
  if (mode !== 'trial' || !trialEndsAt) return null
  const ms = new Date(trialEndsAt).getTime() - Date.now()
  if (!Number.isFinite(ms)) return null
  return Math.ceil(ms / (24 * 60 * 60 * 1000))
}

// The default free run an enterprise team gets before its debit order starts.
// Overridable per team: this is the suggestion, not a rule.
export const DEFAULT_ENTERPRISE_FREE_DAYS = 60

// Days until a debit order starts collecting, counted in whole calendar days:
// 0 means it starts today, negative means it already started. Null when the
// team is not on a debit order, or has no start date, which means collect now.
//
// Calendar days, not elapsed milliseconds. Rounding a duration made "60 days
// from now" report 61, which then tripped the admin's own "longer than usual"
// warning on the 60-day button offered as the usual choice.
export function orgBillingStartsInDays(mode: string | null, billingStartsOn: string | null): number | null {
  if (mode !== 'debit_order' || !billingStartsOn) return null
  const start = midnight(billingStartsOn)
  if (!Number.isFinite(start)) return null
  return Math.round((start - todayMidnight()) / (24 * 60 * 60 * 1000))
}

// A signed enterprise team whose free run has not finished yet. Live, counted
// as contracted revenue, but nothing should be collected from them.
export function orgIsPreBilling(mode: string | null, billingStartsOn: string | null): boolean {
  const days = orgBillingStartsInDays(mode, billingStartsOn)
  return days !== null && days > 0
}

// A debit_order team nobody has collected from for over a month, or ever.
// Nothing collects automatically, so this is the only thing that will notice.
//
// billingStartsOn is required rather than optional on purpose. Both callers
// had to be revisited when it was added, and a caller that forgets it would
// silently get the old behaviour: nagging every day of a team's free run,
// which is exactly the noise the date exists to prevent.
export function orgNeedsCollecting(mode: string | null, lastCollectedOn: string | null, billingStartsOn: string | null): boolean {
  if (mode !== 'debit_order') return false
  if (orgIsPreBilling(mode, billingStartsOn)) return false
  if (!lastCollectedOn) return true
  // Once the free run ends, the clock starts from the start date rather than
  // from never: a team that went live in January and starts billing in March
  // is due in March, not thirty days overdue on day one.
  const since = Math.max(
    midnight(lastCollectedOn),
    billingStartsOn ? midnight(billingStartsOn) : 0,
  )
  const days = (todayMidnight() - since) / (24 * 60 * 60 * 1000)
  return !Number.isFinite(days) || days >= 30
}

// A date column comes back as YYYY-MM-DD, which Date parses as midnight UTC.
// Everything here is counted in local calendar days, so pin both sides to
// local midnight rather than comparing a UTC instant against "now".
function midnight(d: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d))
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime()
  const t = new Date(d).getTime()
  if (!Number.isFinite(t)) return NaN
  const local = new Date(t)
  return new Date(local.getFullYear(), local.getMonth(), local.getDate()).getTime()
}
function todayMidnight(): number {
  const n = new Date()
  return new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime()
}

/**
 * DOES THIS ORGANISATION ENTITLE ITS PEOPLE TO PRO?
 *
 * ONE RULE, TWO CALLERS, ON PURPOSE. plan-server decides what the dashboard
 * shows and TeamCardPublic decides what a visitor gets, and plan-server's own
 * comment names the failure this avoids: "the dashboard disagreeing with the
 * public page about who is entitled is precisely the drift subscriptionState
 * exists to prevent." Two copies of this would drift the first time one of the
 * four conditions changed.
 *
 * WHAT IT REPLACES. Both sides asked only "is the org suspended". That was
 * chosen deliberately - enterprise orgs are comped, so business_plan_active is
 * not a reliable signal of a real customer - and it left one case entitled
 * that should not be. create_org inserts the organisation BEFORE payment, and
 * add_card never checks payment, so somebody could pick twenty seats, abandon
 * the Paystack checkout, add twenty cards and have the lot running for nothing
 * until a human noticed and suspended them.
 *
 * The four states are now told apart:
 *
 *   suspended                 no, whatever else is true
 *   business_plan_active      yes - they paid, or an admin marked them live
 *   billing_period 'comp'     yes - comped on purpose, which is the case that
 *                             stopped business_plan_active being usable alone
 *   trial_ends_at in future   yes - and this is what makes a team trial
 *                             expressible at all
 *   none of the above         no. An abandoned checkout is not a customer.
 *
 * Checked against every organisation that exists at the time of writing:
 * all of them are business_plan_active, so none changes state.
 */
export function orgEntitlesMembers(org: {
  suspended_at?: string | null
  business_plan_active?: boolean | null
  billing_period?: string | null
  trial_ends_at?: string | null
} | null | undefined): boolean {
  if (!org) return false
  if (org.suspended_at) return false
  if (org.business_plan_active) return true
  if (org.billing_period === 'comp') return true
  const ends = org.trial_ends_at ? Date.parse(org.trial_ends_at) : NaN
  if (Number.isFinite(ends) && ends > Date.now()) return true
  return false
}

export function isOrgBillingMode(s: unknown): s is OrgBillingMode {
  return typeof s === 'string' && (ORG_BILLING_MODES as readonly string[]).includes(s)
}

// What this team is worth per month, or 0 when nobody is billing it.
export function orgMonthlyRand(maxSeats: number, mode: OrgBillingMode | string | null): number {
  if (!isOrgBillingMode(mode) || !BILLING_MODE_META[mode].isRevenue) return 0
  if (mode === 'yearly') return Math.round((maxSeats * SEAT_PRICE_RAND * 10) / 12) // 2 months free
  return maxSeats * SEAT_PRICE_RAND
}
