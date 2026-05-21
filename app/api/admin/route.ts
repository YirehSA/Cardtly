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

  // Activate Pro for a user. Uses delete-then-insert because the
  // whop_subscriptions table has no unique constraint on user_id, so
  // .upsert({...}, { onConflict: 'user_id' }) fails silently. The two
  // statements below give us an idempotent "set this user to Pro"
  // operation that works whether they had a previous subscription row
  // (free, cancelled, expired) or none at all.
  if (action === 'activate_pro') {
    const { user_id, email } = body
    if (!user_id) {
      return NextResponse.json({ error: 'user_id required' }, { status: 400 })
    }
    const { error: deleteError } = await admin
      .from('whop_subscriptions')
      .delete()
      .eq('user_id', user_id)
    if (deleteError) {
      console.error('activate_pro delete error:', deleteError)
    }
    const { error: insertError } = await admin
      .from('whop_subscriptions')
      .insert({
        user_id,
        email,
        plan_id: 'pro_admin',
        subscription_tier: 'pro',
        status: 'active',
        billing_cycle: 'monthly',
        seats: 1,
        metadata: { comped: true, reason: 'admin_activated' },
      })
    if (insertError) {
      console.error('activate_pro insert error:', insertError)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  }

  // Deactivate Pro. Plain UPDATE works because we're matching by
  // user_id, not relying on an upsert conflict path.
  if (action === 'deactivate_pro') {
    const { user_id } = body
    if (!user_id) {
      return NextResponse.json({ error: 'user_id required' }, { status: 400 })
    }
    const { error } = await admin.from('whop_subscriptions').update({
      status: 'cancelled',
      updated_at: new Date().toISOString(),
    }).eq('user_id', user_id)
    if (error) {
      console.error('deactivate_pro error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
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

  // Resend the email-confirmation link to a user who never confirmed.
  // Uses Supabase's built-in resend, which respects whatever Custom SMTP
  // is configured at the project level (Resend, in our case).
  if (action === 'resend_confirmation') {
    const { email } = body
    if (!email) {
      return NextResponse.json({ error: 'email required' }, { status: 400 })
    }
    const { error } = await admin.auth.resend({ type: 'signup', email })
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  }

  // Force-confirm a user's email without them clicking the link. For
  // support cases where the email won't arrive (forwarder broken,
  // typo, etc.). They can still log in with their existing password.
  if (action === 'force_confirm') {
    const { user_id } = body
    if (!user_id) {
      return NextResponse.json({ error: 'user_id required' }, { status: 400 })
    }
    const { error } = await admin.auth.admin.updateUserById(user_id, {
      email_confirm: true,
    })
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  }

  // Trigger a password-reset email to a user. The link Supabase sends
  // points back to /reset-password on cardtly.com where the user picks
  // a new password.
  if (action === 'send_password_reset') {
    const { email } = body
    if (!email) {
      return NextResponse.json({ error: 'email required' }, { status: 400 })
    }
    const { error } = await admin.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'https://cardtly.com'}/reset-password`,
    })
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  }

  // Hard-delete a user and every record we own about them. Mirrors the
  // self-service /api/account/delete route but is initiated by the
  // admin, not the user themselves. Cannot delete the admin's own
  // account through here, as a foot-gun guard.
  if (action === 'delete_user') {
    const { user_id } = body
    if (!user_id || typeof user_id !== 'string') {
      return NextResponse.json({ error: 'user_id required' }, { status: 400 })
    }
    if (user_id === ADMIN_USER_ID) {
      return NextResponse.json({ error: 'Cannot delete the admin account from here' }, { status: 400 })
    }

    try {
      const { data: userCards } = await admin.from('cards').select('id').eq('user_id', user_id)
      const cardIds = (userCards || []).map((c: { id: string }) => c.id)

      if (cardIds.length > 0) {
        await admin.from('contacts').delete().in('card_id', cardIds)
        await admin.from('slug_redirects').delete().in('card_id', cardIds)
      }

      const { data: userOrgs } = await admin.from('organizations').select('id').eq('admin_user_id', user_id)
      const orgIds = (userOrgs || []).map((o: { id: string }) => o.id)
      if (orgIds.length > 0) {
        await admin.from('team_cards').delete().in('organization_id', orgIds)
      }
      await admin.from('organizations').delete().eq('admin_user_id', user_id)
      await admin.from('nfc_orders').delete().eq('user_id', user_id)
      await admin.from('whop_subscriptions').delete().eq('user_id', user_id)
      await admin.from('cards').delete().eq('user_id', user_id)
      await admin.from('profiles').delete().eq('user_id', user_id)

      const { error: authError } = await admin.auth.admin.deleteUser(user_id)
      if (authError) {
        return NextResponse.json({ error: authError.message }, { status: 500 })
      }
      return NextResponse.json({ success: true })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Deletion failed'
      return NextResponse.json({ error: message }, { status: 500 })
    }
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
