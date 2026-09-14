import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

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

    // Delete any existing subscription row for this user, then insert
    // the fresh one. Avoids the .upsert({...}, { onConflict: 'user_id' })
    // path because whop_subscriptions has no unique constraint on
    // user_id, which caused upserts to fail silently on existing rows.
    await supabase.from('whop_subscriptions').delete().eq('user_id', userId)
    await supabase.from('whop_subscriptions').insert({
      user_id: userId,
      email: data.data.customer.email,
      plan_id: `paystack_${plan}`,
      subscription_tier: 'pro',
      billing_cycle: plan,
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

    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/upgrade/success?plan=${plan}`)
  } catch (error) {
    console.error('Paystack verify error:', error)
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/upgrade/cancel?reason=server_error`)
  }
}
