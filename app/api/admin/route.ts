import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { isAdminUser, FOUNDER_ADMIN_USER_ID } from '@/lib/admin-check'
import { sendPasswordResetEmail } from '@/lib/password-reset'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!await isAdminUser(user?.id)) {
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

  // Email a user a password-reset link. Uses the token_hash flow
  // (lib/password-reset) so the link works on any device - the old
  // resetPasswordForEmail produced PKCE links that only worked in the
  // browser that requested them, which never works for an admin-
  // triggered reset (different person, different browser).
  if (action === 'send_password_reset') {
    const { email } = body
    if (!email) {
      return NextResponse.json({ error: 'email required' }, { status: 400 })
    }
    const origin = process.env.NEXT_PUBLIC_APP_URL || 'https://cardtly.com'
    const result = await sendPasswordResetEmail(email, origin)
    if (!result.ok && result.reason !== 'no_user') {
      return NextResponse.json({ error: result.error || 'Could not send reset email' }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  }

  // Directly set a new password for a user. Unlike send_password_reset
  // (which emails them a link), this lets the admin choose the password
  // and hand it to the client on a call - useful when the client can't
  // receive the reset email or needs immediate access. The new password
  // takes effect instantly; the admin relays it to the client.
  if (action === 'set_password') {
    const { user_id, password } = body as { user_id?: string; password?: string }
    if (!user_id || !password) {
      return NextResponse.json({ error: 'user_id and password required' }, { status: 400 })
    }
    if (typeof password !== 'string' || password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }
    const { error } = await admin.auth.admin.updateUserById(user_id, { password })
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
    if (user_id === FOUNDER_ADMIN_USER_ID) {
      return NextResponse.json({ error: 'Cannot delete the founder admin account from here' }, { status: 400 })
    }
    if (user_id === user!.id) {
      return NextResponse.json({ error: 'Cannot delete yourself from here' }, { status: 400 })
    }

    // Helper: try a delete, capture the error but don't bail out the
    // whole transaction. Some rows may not exist for every user;
    // we only abort if the actual auth.users delete fails at the end.
    const steps: Array<{ step: string; error?: string }> = []
    async function step(name: string, op: Promise<{ error: any }>): Promise<void> {
      try {
        const { error } = await op
        if (error) steps.push({ step: name, error: error.message || String(error) })
        else steps.push({ step: name })
      } catch (e: any) {
        steps.push({ step: name, error: e?.message || String(e) })
      }
    }

    try {
      // 1. Personal cards + their dependents
      const { data: userCards } = await admin.from('cards').select('id').eq('user_id', user_id)
      const cardIds = (userCards || []).map((c: { id: string }) => c.id)
      if (cardIds.length > 0) {
        await step('contacts (by card_id)',      admin.from('contacts').delete().in('card_id', cardIds))
        await step('slug_redirects',             admin.from('slug_redirects').delete().in('card_id', cardIds))
        await step('card_events',                admin.from('card_events').delete().in('card_id', cardIds))
      }

      // 2. Team-card relationships
      //    a. If they OWN an org (admin), kill the team cards under it
      const { data: userOrgs } = await admin.from('organizations').select('id').eq('admin_user_id', user_id)
      const orgIds = (userOrgs || []).map((o: { id: string }) => o.id)
      if (orgIds.length > 0) {
        const { data: teamCards } = await admin.from('team_cards').select('id').in('organization_id', orgIds)
        const teamCardIds = (teamCards || []).map((c: { id: string }) => c.id)
        if (teamCardIds.length > 0) {
          await step('contacts (by team_card_id)', admin.from('contacts').delete().in('team_card_id', teamCardIds))
        }
        await step('team_cards (owned org)',    admin.from('team_cards').delete().in('organization_id', orgIds))
      }
      //    b. If they CLAIMED a team card (member), release it back to admin
      await step('team_cards (member claim release)',
        admin.from('team_cards').update({
          user_id: null,
          claimed_at: null,
          invite_email: null,
          invite_token: null,
          invite_sent_at: null,
        } as any).eq('user_id', user_id))

      // 3. Promotions data — FKs are on delete cascade for these, but
      //    do it explicitly so a misconfigured FK can't silently block.
      await step('referrals (as referrer)', admin.from('referrals').delete().eq('referrer_user_id', user_id))
      await step('referrals (as referred)', admin.from('referrals').delete().eq('referred_user_id', user_id))
      await step('promo_entries',           admin.from('promo_entries').delete().eq('user_id', user_id))
      await step('promo_winners',           admin.from('promo_winners').delete().eq('user_id', user_id))

      // 4. Org, subs, NFC orders, primary cards, profile
      await step('organizations',     admin.from('organizations').delete().eq('admin_user_id', user_id))
      await step('nfc_orders',        admin.from('nfc_orders').delete().eq('user_id', user_id))
      await step('whop_subscriptions', admin.from('whop_subscriptions').delete().eq('user_id', user_id))
      await step('cards',             admin.from('cards').delete().eq('user_id', user_id))
      await step('profiles',          admin.from('profiles').delete().eq('user_id', user_id))

      // 5. The auth row itself — this is the one that must succeed.
      const { error: authError } = await admin.auth.admin.deleteUser(user_id)
      if (authError) {
        // Bubble up details of which prior steps failed so we can debug.
        const stepErrors = steps.filter(s => s.error).map(s => `${s.step}: ${s.error}`).join(' | ')
        return NextResponse.json({
          error: `${authError.message}${stepErrors ? ' — prior failures: ' + stepErrors : ''}`,
        }, { status: 500 })
      }
      return NextResponse.json({ success: true, steps })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Deletion failed'
      return NextResponse.json({ error: message, steps }, { status: 500 })
    }
  }

  // Post or update the single active announcement banner shown to all
  // logged-in users on the dashboard. Sets is_active=false on every
  // existing row first so only one is shown at a time.
  if (action === 'post_announcement') {
    const { message, link_url, link_text, variant, display_style } = body
    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'message required' }, { status: 400 })
    }
    // display_style: 'banner' (top strip) or 'modal' (big popup).
    // Anything unexpected falls back to banner.
    const style = display_style === 'modal' ? 'modal' : 'banner'
    await admin.from('app_announcements').update({ is_active: false }).neq('id', '00000000-0000-0000-0000-000000000000')
    const { error: insertError } = await admin.from('app_announcements').insert({
      message,
      link_url: link_url || null,
      link_text: link_text || null,
      variant: variant || 'info',
      display_style: style,
      is_active: true,
    })
    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  }

  // Clear the active announcement so no banner shows
  if (action === 'clear_announcement') {
    await admin.from('app_announcements').update({ is_active: false }).neq('id', '00000000-0000-0000-0000-000000000000')
    return NextResponse.json({ success: true })
  }

  // Toggle a user's is_admin flag. Granting is unrestricted across
  // admins; revoking has guards so we don't lock out the founder
  // admin or revoke yourself by mistake.
  if (action === 'set_admin') {
    const { user_id, value } = body as { user_id?: string; value?: boolean }
    if (!user_id || typeof value !== 'boolean') {
      return NextResponse.json({ error: 'Missing user_id or value' }, { status: 400 })
    }
    if (!value && user_id === FOUNDER_ADMIN_USER_ID) {
      return NextResponse.json({ error: 'Cannot revoke the founder admin' }, { status: 400 })
    }
    if (!value && user_id === user!.id) {
      return NextResponse.json({ error: 'Cannot revoke your own admin access' }, { status: 400 })
    }
    // upsert so it works even if a profiles row is missing for this
    // user (shouldn't happen, but defensive).
    const { error } = await admin
      .from('profiles')
      .upsert({ user_id, is_admin: value } as any, { onConflict: 'user_id' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, is_admin: value })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
