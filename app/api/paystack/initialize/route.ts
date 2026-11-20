import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserPlan } from '@/lib/plan-server'
import { isIosAppUA } from '@/lib/app-platform'
import { PLAN_CATALOG, soloOnSale } from '@/lib/paid-plans'
import type { BillingCycle, PaidTier } from '@/lib/solo'

// Starts a personal plan checkout: Pro or Cardtly Solo (lib/solo), monthly or
// yearly. Which plan was bought is read back from the payment itself
// (lib/paid-plans), never from the return address.

export async function POST(request: Request) {
  try {
    // Not in the iOS app: it sells nothing (Guideline 3.1.1).
    if (isIosAppUA(request.headers.get('user-agent'))) {
      return NextResponse.json({ error: 'Not available in the app.' }, { status: 403 })
    }
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const plan = body?.plan as BillingCycle
    const tier: PaidTier = body?.tier === 'solo' ? 'solo' : 'pro'
    if (plan !== 'monthly' && plan !== 'yearly') {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
    }

    if (tier === 'solo') {
      if (!soloOnSale()) {
        return NextResponse.json({ error: 'Cardtly Solo is coming soon. Choose Pro for now, or check back shortly.' }, { status: 503 })
      }
      // Never two personal plans billing at once. Upgrading Solo to Pro is
      // handled when Pro is paid (the webhook stops the Solo subscription);
      // going the other way waits for Pro to end.
      const current = await getUserPlan(user.id)
      if (current.tier === 'pro' && current.isActive && !current.isTrial && !current.isPastDue) {
        return NextResponse.json({
          error: current.viaTeam
            ? 'Your team already gives you Pro, so there is nothing to buy.'
            : current.cancelAt
              ? `Your Pro plan runs until ${new Date(current.cancelAt).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })}. Choose Solo once it has ended.`
              : 'You are on Pro. To move to Solo, cancel Pro under Settings first, then choose Solo once it ends.',
        }, { status: 409 })
      }
      if (current.tier === 'solo' && current.isActive && !current.isPastDue && !current.cancelAt) {
        return NextResponse.json({ error: 'You are already on Cardtly Solo.' }, { status: 409 })
      }
    }

    const { cents, code } = PLAN_CATALOG[tier][plan]
    const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL}/upgrade/verify?plan=${plan}&user_id=${user.id}`

    const response = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: user.email,
        amount: cents,
        plan: code,
        callback_url: callbackUrl,
        metadata: {
          user_id: user.id,
          plan,
          tier,
          action: tier === 'solo' ? 'solo_subscription' : 'pro_subscription',
        },
      }),
    })

    const data = await response.json()

    if (!data.status) {
      return NextResponse.json({ error: data.message || 'Payment initialization failed' }, { status: 500 })
    }

    return NextResponse.json({ authorization_url: data.data.authorization_url })
  } catch (error) {
    console.error('Paystack initialize error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
