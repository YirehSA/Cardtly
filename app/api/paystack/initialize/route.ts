import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { plan } = await request.json()

    if (!['monthly', 'yearly'].includes(plan)) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
    }

    const amount = plan === 'monthly' ? 6500 : 60000 // Paystack uses kobo (cents) — R65 = 6500, R600 = 60000

    const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL}/upgrade/verify?plan=${plan}&user_id=${user.id}`

    const response = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: user.email,
        amount,
        currency: 'ZAR',
        callback_url: callbackUrl,
        metadata: {
          user_id: user.id,
          plan,
          cancel_action: `${process.env.NEXT_PUBLIC_APP_URL}/upgrade/cancel`,
        },
        channels: ['card', 'bank', 'ussd', 'qr', 'mobile_money', 'bank_transfer'],
      }),
    })

    const data = await response.json()

    if (!data.status) {
      console.error('Paystack init error:', data)
      return NextResponse.json({ error: data.message || 'Payment initialization failed' }, { status: 500 })
    }

    return NextResponse.json({
      authorization_url: data.data.authorization_url,
      reference: data.data.reference,
    })
  } catch (error) {
    console.error('Paystack initialize error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
