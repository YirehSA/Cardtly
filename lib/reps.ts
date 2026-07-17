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
  active: boolean
  started_on: string | null
  notes: string | null
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

export function computeRep(
  rep: RepRow,
  personal: Array<{ userId: string; email: string | null; name: string | null; sub: any; trialEndsAt: string | null; hasCard: boolean }>,
  orgs: Array<{ id: string; name: string; maxSeats: number; billingPeriod: string | null }>,
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

  return {
    ...rep,
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
