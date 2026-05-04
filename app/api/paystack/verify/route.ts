import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const reference = searchParams.get('reference')
    const plan = searchParams.get('plan') as 'monthly' | 'yearly'
    const userId = searchParams.get('user_id')

    if (!reference || !plan || !userId) {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/upgrade/cancel?reason=missing_params`)
    }

    // Verify with Paystack
    const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      },
    })

    const data = await response.json()

    if (!data.status || data.data.status !== 'success') {
      console.error('Paystack verify failed:', data)
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/upgrade/cancel?reason=payment_failed`)
    }

    const transaction = data.data

    // Calculate subscription end date
    const now = new Date()
    const periodEnd = new Date(now)
    if (plan === 'monthly') {
      periodEnd.setMonth(periodEnd.getMonth() + 1)
    } else {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1)
    }

    const supabase = await createClient()

    // Upsert subscription record
    const { error } = await supabase
      .from('whop_subscriptions')
      .upsert({
        user_id: userId,
        email: transaction.customer.email,
        plan_id: `paystack_${plan}`,
        subscription_tier: 'pro',
        billing_cycle: plan,
        status: 'active',
        receipt_id: reference,
        membership_id: reference,
        metadata: {
          paystack_reference: reference,
          amount: transaction.amount,
          currency: transaction.currency,
          period_end: periodEnd.toISOString(),
          paid_at: transaction.paid_at,
          channel: transaction.channel,
        },
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id',
      })

    if (error) {
      console.error('Supabase upsert error:', error)
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/upgrade/cancel?reason=db_error`)
    }

    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/upgrade/success?plan=${plan}`)
  } catch (error) {
    console.error('Paystack verify error:', error)
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/upgrade/cancel?reason=server_error`)
  }
}
