import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { color, name, title, address, city, province, postal_code, card_id } = body

    if (!color || !name || !address || !city || !province || !postal_code) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // R150 card + R90 shipping = R240 in kobo (cents)
    const amount = 24000

    const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/nfc/verify?user_id=${user.id}`

    const metadata = {
      user_id: user.id,
      card_id,
      color,
      name,
      title: title || '',
      shipping_address: address,
      shipping_city: city,
      shipping_province: province,
      shipping_postal: postal_code,
      order_type: 'nfc_card',
    }

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
        metadata,
        channels: ['card', 'bank', 'ussd', 'bank_transfer'],
      }),
    })

    const data = await response.json()

    if (!data.status) {
      return NextResponse.json({ error: data.message || 'Payment initialization failed' }, { status: 500 })
    }

    // Save pending order to Supabase
    await (supabase.from('nfc_orders') as any).insert({
      user_id: user.id,
      card_id,
      color,
      name_on_card: name,
      title_on_card: title || null,
      shipping_address: address,
      shipping_city: city,
      shipping_province: province,
      shipping_postal: postal_code,
      amount: 24000,
      status: 'pending_payment',
      paystack_reference: data.data.reference,
    })

    return NextResponse.json({ authorization_url: data.data.authorization_url })
  } catch (error) {
    console.error('NFC order error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
