import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Paystack Plan Codes
const PLANS = {
  monthly: 'PLN_lkf7hy3v4mp8w3u',
  yearly:  'PLN_knxb0ve4dn1h6uk',
}

const AMOUNTS = {
  monthly: 9700,   // R97 in kobo
  yearly:  97000,  // R970 in kobo
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { plan } = await request.json()

    if (!['monthly', 'yearly'].includes(plan)) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
    }

    const planCode = PLANS[plan as keyof typeof PLANS]
    const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL}/upgrade/verify?plan=${plan}&user_id=${user.id}`

    const response = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: user.email,
        amount: AMOUNTS[plan as keyof typeof AMOUNTS],
        plan: planCode,
        callback_url: callbackUrl,
        metadata: {
          user_id: user.id,
          plan,
          action: 'pro_subscription',
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
