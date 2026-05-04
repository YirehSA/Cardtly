import { NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const reference = searchParams.get('reference') || searchParams.get('trxref')
  const orgId = searchParams.get('org_id')
  const userId = searchParams.get('user_id')
  const extraSeats = searchParams.get('extra_seats')

  if (!reference || !orgId || !userId) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/team?status=error`)
  }

  try {
    const res = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
    })
    const data = await res.json()

    if (!data.status || data.data.status !== 'success') {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/team?status=failed`)
    }

    const supabase = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const periodEnd = new Date()
    periodEnd.setMonth(periodEnd.getMonth() + 1)

    if (extraSeats) {
      // Adding seats to existing org
      const { data: org } = await supabase.from('organizations').select('max_seats').eq('id', orgId).single()
      await supabase.from('organizations').update({
        max_seats: (org?.max_seats || 0) + parseInt(extraSeats),
        period_end: periodEnd.toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', orgId)
    } else {
      // New org activation
      await supabase.from('organizations').update({
        business_plan_active: true,
        whop_membership_id: reference,
        updated_at: new Date().toISOString(),
      }).eq('id', orgId)
    }

    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/team?status=success`)
  } catch {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/team?status=error`)
  }
}
