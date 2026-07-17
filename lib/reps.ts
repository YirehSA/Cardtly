import { isBillablePaystackSub } from '@/lib/paystack'
import { isOrgBillingMode, BILLING_MODE_META } from '@/lib/org-billing'

// What a rep is owed, and why.
//
// The rule, decided 2026-07-17:
//   - A card counts only once the client is actually PAYING. A trial counts
//     for nothing until it converts, so we never pay R10 on a card earning
//     R0. Trials are still surfaced, separately, as her pipeline.
//   - A team counts as the seats being BILLED (10-seat team = 10 cards),
//     because that is what we invoice. A comped team counts zero: it earns
//     nothing, so it pays nothing.
//   - It is a running count of the CURRENT paying base, not a cumulative
//     tally. A client who leaves stops counting, and the commission on them
//     stops with it.
//   - Commission starts at card 251, not at 250: (paying - target) x rate.

export interface RepRow {
  id: string
  name: string
  email: string | null
  phone: string | null
  target_cards: number
  commission_rand: number
  commission_day: number
  active: boolean
  started_on: string | null
  notes: string | null
}

export interface CommissionPeriod {
  start: Date
  end: Date
  daysLeft: number
  label: string
}

// The commission period, e.g. the 25th to the 25th.
//
// If today is on or after the anchor day, the period that is currently OPEN
// started this month; otherwise it started last month. On 17 July with a 25th
// anchor, the open period is 25 Jun -> 25 Jul, closing in 8 days. That is the
// one you are about to pay.
//
// Day is clamped to 28 at the DB (migration 033) so a boundary always exists
// in February, and the arithmetic below never has to invent the 30th of Feb.
export function commissionPeriod(day: number, now: Date = new Date()): CommissionPeriod {
  const anchor = Math.min(Math.max(Math.trunc(day) || 25, 1), 28)

  const start = new Date(now.getFullYear(), now.getMonth(), anchor)
  // Before the anchor day, the open period began last month.
  if (now.getDate() < anchor) start.setMonth(start.getMonth() - 1)
  start.setHours(0, 0, 0, 0)

  const end = new Date(start)
  end.setMonth(end.getMonth() + 1)

  const daysLeft = Math.max(0, Math.ceil((end.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)))
  const fmt = (d: Date) => d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })
  return { start, end, daysLeft, label: `${fmt(start)} to ${fmt(end)}` }
}

export function toDateOnly(d: Date): string {
  // Local calendar date, not UTC: a period boundary is a date on a wall
  // calendar, and toISOString would shift it either side of midnight.
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

export interface RepClient {
  kind: 'personal' | 'team'
  id: string
  label: string
  email: string | null
  // Cards this client contributes to the paying count. 0 while on trial or
  // comped.
  cards: number
  // Cards that would count if/when they convert.
  trialCards: number
  state: 'paying' | 'trial' | 'expired' | 'comped'
  mrrRand: number
}

export interface RepStats extends RepRow {
  period: CommissionPeriod
  // Already recorded as paid for the OPEN period, so it is not owed twice.
  paidThisPeriod: boolean
  payouts: RepPayout[]
  payingCards: number
  trialCards: number
  target: number
  // Cards above the target. Commission is paid on exactly these.
  billableCards: number
  commissionRand: number
  // What this rep's book is worth to Cardtly per month.
  bookMrrRand: number
  // How far off target, when under.
  shortBy: number
  clients: RepClient[]
}

const PRO_RAND = 97

export interface RepPayout {
  id: string
  period_start: string
  period_end: string
  paying_cards: number
  billable_cards: number
  commission_rand: number
  paid_at: string | null
  notes: string | null
}

export function computeRep(
  rep: RepRow,
  personal: Array<{ userId: string; email: string | null; name: string | null; sub: any; trialEndsAt: string | null; hasCard: boolean }>,
  orgs: Array<{ id: string; name: string; maxSeats: number; billingPeriod: string | null }>,
  payouts: RepPayout[] = [],
): RepStats {
  const clients: RepClient[] = []
  const now = Date.now()

  for (const p of personal) {
    // No card means nothing was ever sold, so it cannot count either way.
    if (!p.hasCard) continue

    let state: RepClient['state']
    let cards = 0
    let trialCards = 0
    let mrr = 0

    if (p.sub && isBillablePaystackSub(p.sub)) {
      state = 'paying'
      cards = 1
      mrr = PRO_RAND
    } else if (p.sub) {
      // Comped. We granted it, so it earns nothing and pays nothing.
      state = 'comped'
    } else {
      const left = p.trialEndsAt ? new Date(p.trialEndsAt).getTime() - now : null
      if (left !== null && Number.isFinite(left) && left <= 0) {
        state = 'expired'
      } else {
        state = 'trial'
        trialCards = 1
      }
    }

    clients.push({
      kind: 'personal', id: p.userId, label: p.name || p.email || p.userId.slice(0, 8),
      email: p.email, cards, trialCards, state, mrrRand: mrr,
    })
  }

  for (const o of orgs) {
    const mode = isOrgBillingMode(o.billingPeriod) ? o.billingPeriod : 'monthly'
    const earns = BILLING_MODE_META[mode].isRevenue
    // Seats billed, not cards created: we invoice for the seats.
    const cards = earns ? o.maxSeats : 0
    clients.push({
      kind: 'team', id: o.id, label: o.name, email: null,
      cards, trialCards: 0,
      state: earns ? 'paying' : 'comped',
      mrrRand: cards * PRO_RAND,
    })
  }

  const payingCards = clients.reduce((n, c) => n + c.cards, 0)
  const trialCards = clients.reduce((n, c) => n + c.trialCards, 0)
  const target = rep.target_cards
  // Commission starts at 251, so subtract the target rather than counting
  // every card once the target is passed.
  const billableCards = Math.max(0, payingCards - target)

  const period = commissionPeriod(rep.commission_day ?? 25)
  const periodStart = toDateOnly(period.start)

  return {
    ...rep,
    period,
    paidThisPeriod: payouts.some(p => p.period_start === periodStart),
    payouts: payouts.slice().sort((a, b) => b.period_start.localeCompare(a.period_start)),
    payingCards,
    trialCards,
    target,
    billableCards,
    commissionRand: billableCards * rep.commission_rand,
    bookMrrRand: clients.reduce((n, c) => n + c.mrrRand, 0),
    shortBy: Math.max(0, target - payingCards),
    clients: clients.sort((a, b) => b.cards - a.cards || b.trialCards - a.trialCards),
  }
}
