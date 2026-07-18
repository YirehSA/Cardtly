import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { cancelSubscriptionsFor, subscriptionCodeOf, isBillablePaystackSub, findActivePaystackSubs } from '@/lib/paystack'
import { auditLog } from '@/lib/admin-audit'

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
    // Stop the money before touching anything else.
    //
    // Deleting the account used to remove our own whop_subscriptions row while
    // leaving the subscription live at Paystack, so the card kept being charged
    // every month for an account that no longer existed - and once the row was
    // gone we no longer held the email or code needed to find it. Cancelling
    // has to happen first, and it has to be able to stop the deletion.
    //
    // Cancelling goes by the customer's EMAIL rather than our stored code: the
    // verify path stores `subscription_code || reference`, so our rows usually
    // hold a transaction reference that cannot be cancelled. See lib/paystack.
    const { data: activeSubs } = await admin
      .from('whop_subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')

    const billable = (activeSubs || []).filter((s: any) => isBillablePaystackSub(s))
    const billingEmail = billable[0]?.email || user.email || ''

    // Our rows say nothing is billable - but they are exactly the thing that
    // has been unreliable, so ask Paystack directly before trusting them. If
    // that lookup cannot run (Paystack down), carry on and delete: we have no
    // evidence of a subscription, and blocking someone from deleting their own
    // account over an outage is the worse failure.
    let mustCancel = billable.length > 0
    if (!mustCancel && billingEmail) {
      const found = await findActivePaystackSubs(billingEmail)
      mustCancel = found.ok && found.subs.length > 0
    }

    if (mustCancel) {
      const result = await cancelSubscriptionsFor(billingEmail, billable[0] ? subscriptionCodeOf(billable[0]) : null)
      if (!result.ok) {
        await auditLog(admin, {
          actorUserId: userId, actorEmail: user.email,
          action: 'delete_account', targetUserId: userId, targetEmail: billingEmail, ok: false,
          detail: { stage: 'paystack_cancel', error: result.error },
        })
        // Refuse to delete. An account that no longer exists cannot be used to
        // find and stop a subscription later, so deleting now would leave them
        // paying with no way back in to fix it.
        return NextResponse.json({
          error: 'We could not cancel your Paystack subscription just now, so we have not deleted anything - '
            + 'deleting while you are still being billed would leave you paying for an account you cannot reach. '
            + 'Please try again shortly, or email andre@cardtly.com and we will cancel it and delete your account for you.',
        }, { status: 502 })
      }
      await auditLog(admin, {
        actorUserId: userId, actorEmail: user.email,
        action: 'delete_account', targetUserId: userId, targetEmail: billingEmail, ok: true,
        detail: { stage: 'paystack_cancel', cancelled: result.cancelled, skipped: result.skipped },
      })
    }

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
