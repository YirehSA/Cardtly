// How a team is billed. Shared by the admin API and the admin UI so the two
// cannot drift (the NFC statuses used to be duplicated in exactly that way).
//
// This column decides whether a team appears as money coming in, so it is
// worth being explicit: three of the four live teams are Cardtly's own or
// deliberately free, and defaulting everything to 'monthly' is what made the
// dashboard report R6,499 of revenue that will never be collected.

export const ORG_BILLING_MODES = ['monthly', 'yearly', 'debit_order', 'comp'] as const
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
