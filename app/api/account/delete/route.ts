import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

// Real account deletion endpoint. Wipes all user-scoped data from
// Supabase and then deletes the auth user. Used by the in-app
// "Delete account" button in Settings, and documented publicly at
// /delete-account so Play Store reviewers and users can find the
// deletion path even without logging in.

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const userId = user.id
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  ) as any

  try {
    // Fetch the user's card IDs first so we can clean up records linked
    // by card_id rather than user_id.
    const { data: userCards } = await admin
      .from('cards')
      .select('id')
      .eq('user_id', userId)
    const cardIds = (userCards || []).map((c: { id: string }) => c.id)

    // Delete contacts collected against any of the user's cards
    if (cardIds.length > 0) {
      await admin.from('contacts').delete().in('card_id', cardIds)
      await admin.from('slug_redirects').delete().in('card_id', cardIds)
    }

    // Delete any orgs owned by this user and their associated team cards
    const { data: userOrgs } = await admin
      .from('organizations')
      .select('id')
      .eq('admin_user_id', userId)
    const orgIds = (userOrgs || []).map((o: { id: string }) => o.id)

    if (orgIds.length > 0) {
      await admin.from('team_cards').delete().in('organization_id', orgIds)
    }
    await admin.from('organizations').delete().eq('admin_user_id', userId)

    // NFC orders placed by the user
    await admin.from('nfc_orders').delete().eq('user_id', userId)

    // Subscription record
    await admin.from('whop_subscriptions').delete().eq('user_id', userId)

    // Personal cards
    await admin.from('cards').delete().eq('user_id', userId)

    // Profile
    await admin.from('profiles').delete().eq('user_id', userId)

    // Finally remove the auth user itself
    const { error: authError } = await admin.auth.admin.deleteUser(userId)
    if (authError) {
      console.error('Auth user deletion failed:', authError)
      return NextResponse.json(
        { error: 'Account deletion partially completed. Please email andre@cardtly.com so we can finish removing your data.' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Account deletion error:', err)
    return NextResponse.json(
      { error: 'Deletion failed. Please email andre@cardtly.com.' },
      { status: 500 }
    )
  }
}
