import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { logSubscriptionChange } from '@/lib/subscription-audit'
import { completeBundlePayment, isBundleTransaction, txMetadata } from '@/lib/pro-bundle-server'
import { planForActivation, planIdFor } from '@/lib/paid-plans'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const reference = searchParams.get('reference') || searchParams.get('trxref')
  const plan = searchParams.get('plan') || 'monthly'
  const userId = searchParams.get('user_id')

  if (!reference || !userId) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/upgrade/cancel?reason=missing_params`)
  }

  try {
    const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
    })

    const data = await response.json()

    if (!data.status || data.data.status !== 'success') {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/upgrade/cancel?reason=payment_failed`)
    }

    // SERVICE ROLE. This writes the subscription that turns a payment into
    // access, and it was doing it through a user-scoped client - which only
    // worked because whop_subscriptions had no row-level security at all.
    // Migration 076 adds it, and under that this delete and insert would both
    // be refused silently: Paystack would take the money, the redirect would
    // look successful, and the customer would still be on a trial.
    const supabase = createServiceClient() as any

    // A bundle payment (Pro year + NFC card) must never be written here as a
    // plain plan: it carries a card order and next year's renewal.
    if (isBundleTransaction(data.data)) {
      const done = await completeBundlePayment(supabase, data.data, 'paystack_verify')
      if (!done.ok) console.error('bundle completion via /api/paystack/verify failed; the webhook will retry:', done.error)
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/upgrade/success?plan=yearly&bundle=1`)
    }

    // What was bought (Pro or Solo) and for whom, read from the payment our
    // server labelled at checkout (lib/paid-plans), not from this address.
    const bought = planForActivation(data.data, plan === 'yearly' ? 'yearly' : 'monthly')
    if (!bought) {
      console.error('api verify: a payment marked as Solo did not match a Solo plan', reference)
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/upgrade/cancel?reason=payment_failed`)
    }
    const owner = String(txMetadata(data.data).user_id || userId)

    // Delete any existing subscription row for this user, then insert
    // the fresh one. Avoids the .upsert({...}, { onConflict: 'user_id' })
    // path because whop_subscriptions has no unique constraint on
    // user_id, which caused upserts to fail silently on existing rows.
    const { data: prior } = await supabase
      .from('whop_subscriptions').select('*').eq('user_id', owner).maybeSingle()

    await supabase.from('whop_subscriptions').delete().eq('user_id', owner)
    await supabase.from('whop_subscriptions').insert({
      user_id: owner,
      email: data.data.customer.email,
      plan_id: planIdFor(bought.tier, bought.cycle),
      subscription_tier: bought.tier,
      billing_cycle: bought.cycle,
      status: 'active',
      receipt_id: reference,
      membership_id: data.data.subscription_code || reference,
      seats: 1,
      metadata: {
        paystack_reference: reference,
        paystack_subscription_code: data.data.subscription_code,
        amount: data.data.amount,
        currency: data.data.currency,
        paid_at: data.data.paid_at,
      },
    })

    await logSubscriptionChange(supabase, {
      change: 'activated', userId: owner, email: data.data.customer.email,
      source: 'paystack_verify', reason: 'payment reference verified',
      before: prior,
      after: { plan_id: planIdFor(bought.tier, bought.cycle), status: 'active',
               subscription_tier: bought.tier, billing_cycle: bought.cycle, seats: 1 },
    })

    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/upgrade/success?plan=${bought.cycle}${bought.tier === 'solo' ? '&tier=solo' : ''}`)
  } catch (error) {
    console.error('Paystack verify error:', error)
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/upgrade/cancel?reason=server_error`)
  }
}
