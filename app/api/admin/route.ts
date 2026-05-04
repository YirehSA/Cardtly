import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

const ADMIN_USER_ID = '6216ca40-72e5-47f2-af6a-a37d35f9d169'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.id !== ADMIN_USER_ID) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  ) as any

  const body = await request.json()
  const { action } = body

  // Activate Pro for a user
  if (action === 'activate_pro') {
    const { user_id, email } = body
    await admin.from('whop_subscriptions').upsert({
      user_id,
      email,
      plan_id: 'pro_admin',
      subscription_tier: 'pro',
      status: 'active',
      billing_cycle: 'monthly',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
    return NextResponse.json({ success: true })
  }

  // Deactivate Pro
  if (action === 'deactivate_pro') {
    const { user_id } = body
    await admin.from('whop_subscriptions').update({
      status: 'cancelled',
      updated_at: new Date().toISOString(),
    }).eq('user_id', user_id)
    return NextResponse.json({ success: true })
  }

  // Create or update org
  if (action === 'create_org') {
    const { user_id, org_name, seat_count } = body

    // Check if org exists
    const { data: existing } = await admin.from('organizations').select('id').eq('admin_user_id', user_id).single()

    if (existing) {
      await admin.from('organizations').update({
        name: org_name,
        max_seats: seat_count,
        business_plan_active: true,
        updated_at: new Date().toISOString(),
      }).eq('id', existing.id)
    } else {
      await admin.from('organizations').insert({
        admin_user_id: user_id,
        name: org_name,
        max_seats: seat_count,
        used_seats: 0,
        business_plan_active: true,
        billing_period: 'monthly',
      })
    }
    return NextResponse.json({ success: true })
  }

  // Update NFC order status
  if (action === 'update_nfc_status') {
    const { order_id, status, tracking_number } = body
    await admin.from('nfc_orders').update({
      status,
      tracking_number: tracking_number || null,
      ...(status === 'shipped' ? { shipped_at: new Date().toISOString() } : {}),
      updated_at: new Date().toISOString(),
    }).eq('id', order_id)
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
