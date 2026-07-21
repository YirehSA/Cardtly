import { createClient, createServiceClient } from '@/lib/supabase/server'
import { UserPlan } from '@/types/database'

const DAY_MS = 24 * 60 * 60 * 1000

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
export async function getUserPlan(userId: string): Promise<UserPlan> {
  const supabase = await createClient()

  // Deliberately not filtered to status = 'active'. A past_due row has to be
  // read to know whether it is still inside its grace window; filtering it out
  // here made a failed payment look identical to having no subscription.
  const { data: sub } = await supabase
    .from('whop_subscriptions')
    .select('subscription_tier, status, billing_cycle, past_due_since')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

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
  const admin = createServiceClient() as any
  const { data: teamCard } = await admin
    .from('team_cards')
    .select('organization_id')
    .eq('user_id', userId)
    .eq('is_active', true)
    .not('organization_id', 'is', null)
    .limit(1)
    .maybeSingle()

  if (teamCard?.organization_id) {
    const { data: org } = await admin
      .from('organizations')
      .select('suspended_at')
      .eq('id', teamCard.organization_id)
      .maybeSingle()
    if (org && !org.suspended_at) {
      return { tier: 'pro', isActive: true, isTrial: false, viaTeam: true }
    }
  }

  const { data: profile } = await supabase
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
