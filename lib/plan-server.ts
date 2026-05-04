import { createClient } from '@/lib/supabase/server'
import { UserPlan, PlanTier } from '@/types/database'

export async function getUserPlan(userId: string): Promise<UserPlan> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('whop_subscriptions')
    .select('subscription_tier, status, billing_cycle')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!data) {
    return { tier: 'free', isActive: false }
  }

  return {
    tier: (data.subscription_tier as PlanTier) || 'free',
    isActive: data.status === 'active',
    billingCycle: data.billing_cycle,
  }
}