import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getUserPlan } from '@/lib/plan-server'
import UpgradeView from '@/components/upgrade/UpgradeView'

export const metadata = { title: 'Upgrade' }

export default async function UpgradePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // This page used to be plan-blind, so it said exactly the same thing to
  // someone on day two of a trial, someone whose card had already gone
  // offline, and someone who was paying already. Those three people need to
  // read three different things, and the middle one is the whole reason the
  // page exists.
  const plan = await getUserPlan(user.id)
  const state: 'trial' | 'expired' | 'paid' =
    plan.tier === 'expired' ? 'expired' : plan.isTrial ? 'trial' : 'paid'

  return <UpgradeView state={state} trialDaysLeft={plan.trialDaysLeft ?? 0} />
}
