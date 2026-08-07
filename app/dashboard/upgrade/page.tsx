import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getUserPlan } from '@/lib/plan-server'
import { isIosApp } from '@/lib/app-platform'
import UpgradeView from '@/components/upgrade/UpgradeView'

export const metadata = { title: 'Upgrade' }

export default async function UpgradePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // This page is the whole of Apple's Guideline 3.1.1 rejection in one screen:
  // the price, the Pay button that opened a Paystack card form inside the app,
  // and the trial code box they flagged separately. Middleware already turns
  // the iOS app away before it gets here; this is the second lock, so the page
  // stays closed even if a route matcher is ever edited without thinking about
  // it. Cheap, and the cost of being wrong is another rejection.
  if (await isIosApp()) redirect('/dashboard')

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
