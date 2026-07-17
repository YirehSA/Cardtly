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
    desc: 'Enterprise. Invoiced and collected outside Paystack. Real revenue, but nothing collects it automatically: you do.',
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

// A debit_order team nobody has collected from for over a month, or ever.
// Nothing collects automatically, so this is the only thing that will notice.
export function orgNeedsCollecting(mode: string | null, lastCollectedOn: string | null): boolean {
  if (mode !== 'debit_order') return false
  if (!lastCollectedOn) return true
  const days = (Date.now() - new Date(lastCollectedOn).getTime()) / (24 * 60 * 60 * 1000)
  return !Number.isFinite(days) || days >= 30
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
