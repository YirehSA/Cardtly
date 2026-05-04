import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const reference = searchParams.get('reference') || searchParams.get('trxref')
  const userId = searchParams.get('user_id')

  if (!reference || !userId) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/nfc?status=error`)
  }

  try {
    const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
    })

    const data = await response.json()

    if (!data.status || data.data.status !== 'success') {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/nfc?status=failed`)
    }

    const supabase = await createClient() as any

    await supabase
      .from('nfc_orders')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString(),
      })
      .eq('paystack_reference', reference)
      .eq('user_id', userId)

    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/nfc?status=success`)
  } catch (error) {
    console.error('NFC verify error:', error)
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/nfc?status=error`)
  }
}
