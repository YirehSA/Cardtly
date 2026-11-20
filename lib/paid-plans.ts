import { PAYSTACK_PLAN_CODES } from './paystack'
import type { BillingCycle, PaidTier } from './solo'

// The personal plans Paystack bills, and how a payment is matched to one.
//
// SOLO'S PLAN CODES are created by Andre in the Paystack dashboard ("Cardtly
// Solo Monthly" R49 monthly, "Cardtly Solo Yearly" R450 annually). Until both
// are filled in below, Solo cannot be bought: checkout answers "coming soon"
// instead of charging a plan that does not exist.
//
// WHICH PLAN A PAYMENT WAS FOR is read from the payment, never from the
// address it returns to. A return URL can be edited; the plan code, the amount
// and the metadata our own server set at checkout cannot.

// Read from Paystack 2026-11-20: monthly bills R49 (4900) monthly, yearly R450
// (45000) annually, both ZAR, on the live account.
export const SOLO_PLAN_CODES: Record<BillingCycle, string> = {
  monthly: 'PLN_1u5pk5f8h37xr8n',
  yearly: 'PLN_06rg37pg6kicdtb',
}

export const PLAN_CATALOG: Record<PaidTier, Record<BillingCycle, { cents: number; code: string }>> = {
  pro: {
    monthly: { cents: 9700, code: PAYSTACK_PLAN_CODES.monthly },
    yearly: { cents: 97000, code: PAYSTACK_PLAN_CODES.yearly },
  },
  solo: {
    monthly: { cents: 4900, code: SOLO_PLAN_CODES.monthly },
    yearly: { cents: 45000, code: SOLO_PLAN_CODES.yearly },
  },
}

const TIERS: PaidTier[] = ['pro', 'solo']
const CYCLES: BillingCycle[] = ['monthly', 'yearly']

/** Both Solo plans exist in Paystack, so Solo can be sold. */
export function soloOnSale(): boolean {
  return !!(SOLO_PLAN_CODES.monthly && SOLO_PLAN_CODES.yearly)
}

/** Our plan_id for a paid personal plan. Starts with 'paystack' on purpose:
 *  cancelling, reconciling and the reseller free card all look for that. */
export function planIdFor(tier: PaidTier, cycle: BillingCycle): string {
  return tier === 'solo' ? `paystack_solo_${cycle}` : `paystack_${cycle}`
}

/** Is this Paystack plan code one of Solo's? */
export function isSoloPlanCode(code: unknown): boolean {
  return !!code && (code === SOLO_PLAN_CODES.monthly || code === SOLO_PLAN_CODES.yearly)
}

function metadataOf(tx: any): any {
  const m = tx?.metadata
  if (typeof m === 'string') { try { return JSON.parse(m) } catch { return {} } }
  return m || {}
}

function planCodeOf(tx: any): string | null {
  const p = tx?.plan_object?.plan_code ?? (typeof tx?.plan === 'string' ? tx.plan : tx?.plan?.plan_code)
  return typeof p === 'string' && p.startsWith('PLN_') ? p : null
}

/**
 * The plan a successful Paystack payment was for, or null when it matches
 * none (and so must not switch anything on).
 *   1. Its plan code, when Paystack reports one: exact.
 *   2. The tier and cycle our checkout wrote into its metadata, with the
 *      amount it should cost.
 *   3. A payment from before Solo existed (metadata with a cycle and no
 *      tier): Pro, if at least Pro's price was paid.
 * Never Pro for less than Pro's price, however the metadata reads.
 */
export function paidPlanOf(tx: any): { tier: PaidTier; cycle: BillingCycle } | null {
  const code = planCodeOf(tx)
  if (code) {
    for (const tier of TIERS) for (const cycle of CYCLES) {
      if (PLAN_CATALOG[tier][cycle].code && PLAN_CATALOG[tier][cycle].code === code) return { tier, cycle }
    }
  }
  const meta = metadataOf(tx)
  const cycle: BillingCycle | null = meta.plan === 'yearly' ? 'yearly' : meta.plan === 'monthly' ? 'monthly' : null
  if (!cycle) return null
  const amount = Number(tx?.amount)
  if (meta.tier === 'solo') return amount === PLAN_CATALOG.solo[cycle].cents ? { tier: 'solo', cycle } : null
  return Number.isFinite(amount) && amount >= PLAN_CATALOG.pro[cycle].cents ? { tier: 'pro', cycle } : null
}

/**
 * What a successful payment switches on. paidPlanOf when it knows; otherwise
 * Pro, exactly as every payment was read before Solo existed (team payments,
 * old renewals at an older price), so nothing that worked changes. The one
 * exception: a payment our checkout marked as Solo that does not add up
 * switches nothing on, and never falls through to Pro.
 */
export function planForActivation(tx: any, fallbackCycle: BillingCycle = 'monthly'): { tier: PaidTier; cycle: BillingCycle } | null {
  const known = paidPlanOf(tx)
  if (known) return known
  const meta = metadataOf(tx)
  if (meta.tier === 'solo') return null
  return { tier: 'pro', cycle: meta.plan === 'yearly' ? 'yearly' : meta.plan === 'monthly' ? 'monthly' : fallbackCycle }
}
