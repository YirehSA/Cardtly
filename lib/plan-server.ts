import { createServiceClient } from '@/lib/supabase/server'
import { UserPlan } from '@/types/database'
import { orgEntitlesMembers } from '@/lib/org-billing'
import { isMissingColumn } from '@/lib/pg-errors'

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * The newest subscription row for a user, carrying exactly the columns
 * subscriptionState reads.
 *
 * ONE SELECT, SHARED BY THE DASHBOARD AND THE PUBLIC CARD PAGE. Each used to
 * write its own column list, which is how a new column gets added to one and
 * not the other: the dashboard would honour a cancellation that the public card
 * never heard about, and a cancelled card would keep serving to the world while
 * its owner was told it had stopped. scripts/check-subscription-state.mjs holds
 * both callers to this function.
 *
 * FALLS BACK WITHOUT cancel_at IF MIGRATION 090 HAS NOT RUN. This is not
 * caution for its own sake. Selecting a column that does not exist is an
 * error, the callers read an error as "no row", and "no row" means "not paying"
 * - so a deploy that landed before the migration would have taken every paying
 * customer's card offline at once. Tested against the real database with the
 * column absent before the migration was run, because a fallback that has
 * never met the error it catches is not a fallback.
 *
 * Not filtered to status = 'active': a past_due row has to be read to know
 * whether it is still inside its grace window.
 */
export async function latestSubscriptionFor(admin: any, userId: string, extraColumns = ''): Promise<any | null> {
  const base = ['subscription_tier', 'status', 'past_due_since', extraColumns].filter(Boolean).join(', ')
  const run = (cols: string) => admin
    .from('whop_subscriptions')
    .select(cols)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  let { data, error } = await run(`${base}, cancel_at`)
  if (error && isMissingColumn(error)) ({ data, error } = await run(base))
  return error ? null : data
}

// How long a card keeps serving after a payment fails. Paystack retries a
// failed invoice over the following days, so cutting a card off at the first
// decline punishes people for a bank hiccup that usually resolves itself.
export const PAYMENT_GRACE_DAYS = 7

// Whether a subscription row still entitles the account, and why.
//
// Shared by the dashboard and the public card page so the two cannot drift
// into disagreeing about whether someone is paid up - the bug that would show
// as a dashboard saying "active" over a card returning 404.
export function subscriptionState(sub: {
  subscription_tier?: string | null
  status?: string | null
  past_due_since?: string | null
  cancel_at?: string | null
} | null): { serves: boolean; isPastDue: boolean; graceEndsAt: string | null; graceDaysLeft: number; cancelAt: string | null } {
  const base = baseSubscriptionState(sub)

  // A CANCELLED SUBSCRIPTION SERVES UNTIL THE END OF WHAT WAS PAID FOR, then
  // stops. The row stays 'active' in the meantime (see migration 090), so this
  // is the only place that has to know the difference.
  //
  // An unreadable date is ignored rather than obeyed, for the same reason as
  // everywhere else in this file: this gate can take a live card offline, and
  // a data fault must never be what does it.
  const endsMs = sub?.cancel_at ? new Date(sub.cancel_at).getTime() : NaN
  if (!Number.isFinite(endsMs)) return { ...base, cancelAt: null }
  return { ...base, serves: base.serves && endsMs > Date.now(), cancelAt: sub!.cancel_at! }
}

function baseSubscriptionState(sub: {
  subscription_tier?: string | null
  status?: string | null
  past_due_since?: string | null
} | null): { serves: boolean; isPastDue: boolean; graceEndsAt: string | null; graceDaysLeft: number } {
  const none = { serves: false, isPastDue: false, graceEndsAt: null, graceDaysLeft: 0 }
  if (!sub || sub.subscription_tier !== 'pro') return none

  if (sub.status === 'active') {
    return { serves: true, isPastDue: false, graceEndsAt: null, graceDaysLeft: 0 }
  }

  if (sub.status === 'past_due') {
    // No start time recorded: fail open and keep serving. The same reasoning as
    // planFromTrial - this gate can take a live card down, so a data gap must
    // never be the thing that does it.
    if (!sub.past_due_since) {
      return { serves: true, isPastDue: true, graceEndsAt: null, graceDaysLeft: PAYMENT_GRACE_DAYS }
    }
    const startedMs = new Date(sub.past_due_since).getTime()
    if (!Number.isFinite(startedMs)) {
      return { serves: true, isPastDue: true, graceEndsAt: null, graceDaysLeft: PAYMENT_GRACE_DAYS }
    }
    const endsMs = startedMs + PAYMENT_GRACE_DAYS * DAY_MS
    const msLeft = endsMs - Date.now()
    return {
      serves: msLeft > 0,
      isPastDue: true,
      graceEndsAt: new Date(endsMs).toISOString(),
      graceDaysLeft: Math.max(0, Math.ceil(msLeft / DAY_MS)),
    }
  }

  // cancelled, or anything unrecognised.
  return none
}

// Resolves what an account is actually entitled to right now.
//
// There is no free tier. The order is:
//   1. An active paid subscription wins. That is Pro.
//   2. Otherwise, if the 60-day trial has not run out, treat it exactly like
//      Pro so the trial is the real product, not a crippled preview.
//   3. Otherwise the account is expired: Pro features lock and the public
//      card stops serving (see app/card/[slug]/page.tsx).
//
// A missing trial_ends_at is deliberately treated as "still trialing". This
// gate can take a live card offline, so when in doubt it must fail open.
// An organisation entitles its people per orgEntitlesMembers, which is shared
// with TeamCardPublic so the dashboard and the public card cannot answer this
// differently. This used to be "not suspended" alone: correct about comped
// enterprise orgs, and wrong about an organisation that was created, never
// paid for, and filled with cards anyway. See lib/org-billing.
async function orgEntitles(admin: any, orgId: string): Promise<boolean> {
  const { data: org } = await admin
    .from('organizations')
    .select('suspended_at, business_plan_active, billing_period, trial_ends_at')
    .eq('id', orgId)
    .maybeSingle()
  return orgEntitlesMembers(org)
}

export async function getUserPlan(userId: string): Promise<UserPlan> {
  // SERVICE ROLE, for every read in this function.
  //
  // It used to open a user-scoped client for the subscription and the profile,
  // which worked only because whop_subscriptions had no row-level security on
  // it at all: the anon key could read, insert, update and delete every row in
  // that table, which is a customer list with email addresses and a way to hand
  // yourself a Pro subscription. Migration 076 closes it, and closing it would
  // have returned nothing to a user-scoped read - dropping every paying
  // customer to expired the moment it ran.
  //
  // Safe here because this is a server module, userId is a parameter rather
  // than anything a request can choose, and every query below is pinned to it.
  // The rest of the function was already using the service client for the team
  // and department lookups, so this is now one client instead of two.
  const admin = createServiceClient() as any

  // Deliberately not filtered to status = 'active'. A past_due row has to be
  // read to know whether it is still inside its grace window; filtering it out
  // here made a failed payment look identical to having no subscription.
  const sub = await latestSubscriptionFor(admin, userId, 'billing_cycle')

  const state = subscriptionState(sub as any)
  if (state.serves) {
    return {
      tier: 'pro',
      isActive: true,
      billingCycle: (sub as any).billing_cycle,
      isTrial: false,
      isPastDue: state.isPastDue,
      graceEndsAt: state.graceEndsAt,
      graceDaysLeft: state.graceDaysLeft,
      cancelAt: state.cancelAt,
    }
  }

  // Covered by an organisation.
  //
  // A team member has no subscription of their own - the org pays for their
  // seat - so without this they fall through to their own signup trial and
  // are treated as a trialist who will expire. That is wrong in both
  // directions: the dashboard tells a paid-for member their access is running
  // out, and on day 61 they lose Pro pages their company is paying for.
  //
  // This lives here rather than as a per-page check because it had already
  // been written by hand on six pages and forgotten on the seventh - the NFC
  // page, which would have locked team members out. Resolving it once means
  // every page, and every page added later, inherits it.
  //
  // Service role: team_cards is RLS-protected and a member cannot always read
  // their own row through the user-scoped client.
  //
  // Suspension is the switch, not business_plan_active. That matches the
  // public card page, which serves team cards unless the org is suspended -
  // and the dashboard disagreeing with the public page about who is entitled
  // is precisely the drift subscriptionState exists to prevent.
  const { data: teamCard } = await admin
    .from('team_cards')
    .select('organization_id')
    .eq('user_id', userId)
    .eq('is_active', true)
    .not('organization_id', 'is', null)
    .limit(1)
    .maybeSingle()

  if (teamCard?.organization_id && (await orgEntitles(admin, teamCard.organization_id))) {
    return { tier: 'pro', isActive: true, isTrial: false, viaTeam: true }
  }

  // A department head is part of an organisation without necessarily holding a
  // card in it. Keying only on team_cards missed them: they manage a
  // department, invite people, and set the department's brand, while their own
  // account quietly counts down a signup trial. Every enterprise head appointed
  // on a comped org would land in that state.
  const { data: managed } = await admin
    .from('department_managers')
    .select('department_id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle()

  if (managed?.department_id) {
    const { data: dept } = await admin
      .from('departments')
      .select('organization_id')
      .eq('id', managed.department_id)
      .maybeSingle()
    if (dept?.organization_id && (await orgEntitles(admin, dept.organization_id))) {
      return { tier: 'pro', isActive: true, isTrial: false, viaTeam: true }
    }
  }

  const { data: profile } = await admin
    .from('profiles')
    .select('trial_ends_at')
    .eq('user_id', userId)
    .maybeSingle()

  const trialEndsAt = (profile as any)?.trial_ends_at ?? null
  return planFromTrial(trialEndsAt)
}

// Shared so the public card page and the dashboard agree on the same rule.
export function planFromTrial(trialEndsAt: string | null): UserPlan {
  if (!trialEndsAt) {
    // No date recorded. Fail open rather than take a card offline.
    return { tier: 'pro', isActive: true, isTrial: true, trialEndsAt: null }
  }

  const endsMs = new Date(trialEndsAt).getTime()
  if (!Number.isFinite(endsMs)) {
    return { tier: 'pro', isActive: true, isTrial: true, trialEndsAt }
  }

  const msLeft = endsMs - Date.now()
  if (msLeft > 0) {
    return {
      tier: 'pro',
      isActive: true,
      isTrial: true,
      trialEndsAt,
      trialDaysLeft: Math.max(0, Math.ceil(msLeft / DAY_MS)),
    }
  }

  return { tier: 'expired', isActive: false, isTrial: false, trialEndsAt, trialDaysLeft: 0 }
}
