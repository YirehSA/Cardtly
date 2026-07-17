import { NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const reference = searchParams.get('reference') || searchParams.get('trxref')
  const orgId = searchParams.get('org_id')
  const userId = searchParams.get('user_id')
  // create_org sends seat_count; add_seats sends new_seat_count. Both are the
  // TOTAL seats for the tier that was just paid for, not a delta.
  const seatCount = searchParams.get('seat_count')
  const newSeatCount = searchParams.get('new_seat_count')

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
    // The paid tier is absolute: buying the 20-seat plan means 20 seats in
    // total. Whichever param arrived, it is the new max_seats.
    const paidSeats = parseInt(newSeatCount || seatCount || '', 10)

    const patch: Record<string, unknown> = {
      business_plan_active: true,
      whop_membership_id: reference,
      updated_at: new Date().toISOString(),
    }
    if (Number.isFinite(paidSeats) && paidSeats > 0) patch.max_seats = paidSeats

    const { error: updateError } = await (supabase.from('organizations') as any)
      .update(patch)
      .eq('id', orgId)

    // Never tell an admin the payment worked if we failed to give them the
    // seats they just paid for.
    if (updateError) {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/team?status=error`)
    }

    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/team?status=success`)
  } catch {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/team?status=error`)
  }
}
