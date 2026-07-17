import { createClient } from '@/lib/supabase/server'
import { UserPlan } from '@/types/database'

const DAY_MS = 24 * 60 * 60 * 1000

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

  const { data: sub } = await supabase
    .from('whop_subscriptions')
    .select('subscription_tier, status, billing_cycle')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (sub) {
    return {
      tier: 'pro',
      isActive: true,
      billingCycle: (sub as any).billing_cycle,
      isTrial: false,
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
