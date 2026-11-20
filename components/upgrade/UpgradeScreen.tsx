import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getUserPlan } from '@/lib/plan-server'
import { getPrimaryCard } from '@/lib/card-server'
import { isIosApp } from '@/lib/app-platform'
import UpgradeView from '@/components/upgrade/UpgradeView'
import PricesElsewhere from '@/components/reseller/PricesElsewhere'
import { resellerPriceScope, serviceDb } from '@/lib/reseller'
import { soloOnSale } from '@/lib/paid-plans'

// The upgrade screen, shared by /dashboard/upgrade and /dashboard/upgrade/bundle
// (which opens on the Pro year + NFC card bundle, for links from the pricing
// and NFC pages). Page files cannot export anything else, so the body is here.
export default async function UpgradeScreen({ openBundle = false }: { openBundle?: boolean }) {
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
  const [plan, card, priceScope] = await Promise.all([
    getUserPlan(user.id),
    getPrimaryCard<{ name: string | null; title: string | null }>(user.id, 'name, title'),
    resellerPriceScope(serviceDb(), user.id),
  ])

  // A reseller, or anybody in a team a reseller sold: no Cardtly price, no
  // Paystack checkout, no package offer. The reseller sets the price (Andre,
  // 2026-11-16).
  if (priceScope) {
    return <PricesElsewhere scope={priceScope} topic="upgrade" isPro={plan.tier === 'pro' && plan.isActive} />
  }
  // A fourth person: paying, but the last charge failed. Before this they read
  // "You are already on Pro, nothing to do here" directly under the banner
  // that had sent them to fix a payment.
  // 'choose': a new account that has not chosen a plan or taken the trial
  // (migration 109), told so rather than that a trial has ended.
  const state: 'choose' | 'trial' | 'expired' | 'paid' | 'past_due' =
    plan.needsPlan ? 'choose'
      : plan.tier === 'expired' ? 'expired'
      : plan.isPastDue ? 'past_due'
      : plan.isTrial ? 'trial' : 'paid'

  return (
    <UpgradeView
      state={state}
      trialDaysLeft={plan.trialDaysLeft ?? 0}
      graceDaysLeft={plan.graceDaysLeft ?? 0}
      card={card ? { name: card.name ?? null, title: card.title ?? null } : null}
      openBundle={openBundle}
      // Which plan they pay for now, so the page offers a Solo customer Pro
      // (the way up) and never Solo on top of Pro. Null on a trial or expired.
      currentTier={plan.isActive && !plan.isTrial && (plan.tier === 'pro' || plan.tier === 'solo') ? plan.tier : null}
      soloAvailable={soloOnSale()} />
  )
}
