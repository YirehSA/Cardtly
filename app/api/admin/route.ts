import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { isAdminUser, FOUNDER_ADMIN_USER_ID } from '@/lib/admin-check'
import { sendPasswordResetEmail } from '@/lib/password-reset'
import { auditLog } from '@/lib/admin-audit'
import { cancelSubscriptionsFor, subscriptionCodeOf, isBillablePaystackSub } from '@/lib/paystack'
import { NFC_STATUSES } from '@/lib/nfc'
import { ORG_BILLING_MODES, MAX_SELF_SERVE_SEATS } from '@/lib/org-billing'

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

  // Comp a user to Pro.
  //
  // This used to DELETE every whop_subscriptions row for the user before
  // inserting the comp. On a paying customer that threw away receipt_id and
  // the Paystack subscription code, so Paystack carried on charging them and
  // we no longer had the reference to stop it. One misclick, unrecoverable.
  //
  // Now: never delete. Supersede old rows by marking them cancelled, which
  // keeps the billing history, and refuse outright if the user has a LIVE
  // Paystack subscription, since comping someone we are still charging is
  // almost certainly a mistake. `force` exists for the rare case it isn't.
  if (action === 'activate_pro') {
    const { user_id, email, force } = body
    if (!user_id) {
      return NextResponse.json({ error: 'user_id required' }, { status: 400 })
    }

    const { data: existing } = await admin
      .from('whop_subscriptions').select('*').eq('user_id', user_id)

    const live = (existing || []).find((s: any) => isBillablePaystackSub(s))
    if (live && !force) {
      return NextResponse.json({
        error: 'Paystack is still billing this user. Comping them now would give them free Pro while the charge keeps going out. Use "Cancel subscription" first, or confirm to comp them anyway and cancel it separately.',
        needsForce: true,
      }, { status: 409 })
    }

    // Supersede, do not destroy.
    if ((existing || []).length) {
      await admin.from('whop_subscriptions')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('user_id', user_id)
        .eq('status', 'active')
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
      await auditLog(admin, { actorUserId: user?.id, actorEmail: user?.email, action: 'activate_pro', targetUserId: user_id, targetEmail: email, ok: false, detail: { error: insertError.message } })
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    await auditLog(admin, {
      actorUserId: user?.id, actorEmail: user?.email,
      action: 'activate_pro', targetUserId: user_id, targetEmail: email,
      detail: { superseded: (existing || []).length, forced: !!force },
    })
    return NextResponse.json({ success: true })
  }

  // Remove Pro.
  //
  // This used to flip our own row and stop there. No outbound Paystack cancel
  // existed anywhere, so on a paying customer it removed their access and left
  // Paystack billing them R97 a month indefinitely.
  //
  // Now Paystack is cancelled FIRST, and our row only changes if that worked.
  // The order matters: if Paystack fails, the customer keeps access they are
  // paying for, which is the harmless failure. The reverse is not.
  if (action === 'deactivate_pro') {
    const { user_id } = body
    if (!user_id) {
      return NextResponse.json({ error: 'user_id required' }, { status: 400 })
    }

    const { data: subs } = await admin
      .from('whop_subscriptions').select('*').eq('user_id', user_id).eq('status', 'active')

    // Cancel at Paystack by the customer's EMAIL, not by our stored code.
    // Our rows mostly hold a transaction reference rather than a SUB_ code
    // (the verify path stores `subscription_code || reference`), so trusting
    // the stored value would silently cancel nothing.
    const billable = (subs || []).filter((s: any) => isBillablePaystackSub(s))
    let cancelled: string[] = []
    if (billable.length) {
      const email = billable[0].email
      const r = await cancelSubscriptionsFor(email, subscriptionCodeOf(billable[0]))
      if (!r.ok) {
        await auditLog(admin, {
          actorUserId: user?.id, actorEmail: user?.email,
          action: 'deactivate_pro', targetUserId: user_id, ok: false,
          detail: { stage: 'paystack_cancel', email, error: r.error },
        })
        // Stop here. Do NOT take their access away while Paystack keeps
        // charging them.
        return NextResponse.json({
          error: `Could not cancel their Paystack subscription (${r.error}). Their access is unchanged, because removing it while Paystack still bills them would be worse. Cancel it in the Paystack dashboard, then try again.`,
        }, { status: 502 })
      }
      cancelled = r.cancelled
    }

    const { error } = await admin.from('whop_subscriptions').update({
      status: 'cancelled',
      updated_at: new Date().toISOString(),
    }).eq('user_id', user_id)
    if (error) {
      console.error('deactivate_pro error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    await auditLog(admin, {
      actorUserId: user?.id, actorEmail: user?.email,
      action: 'deactivate_pro', targetUserId: user_id,
      detail: { paystack_cancelled: cancelled, rows: (subs || []).length },
    })
    return NextResponse.json({ success: true, paystackCancelled: cancelled.length })
  }

  // Extend (or set) a user's trial.
  //
  // New. There was no way to do this at all: "give them another two weeks"
  // meant opening the SQL editor against production, which is not something
  // anyone should be doing to hand out a courtesy.
  //
  // Extends from whichever is later, now or their current end date, so
  // extending an already-expired trial gives the full extra time rather than
  // adding days to a date in the past.
  if (action === 'extend_trial') {
    const { user_id, days } = body
    const n = Number(days)
    if (!user_id) return NextResponse.json({ error: 'user_id required' }, { status: 400 })
    if (!Number.isInteger(n) || n < 1 || n > 365) {
      return NextResponse.json({ error: 'Days must be a whole number between 1 and 365' }, { status: 400 })
    }

    const { data: profile } = await admin
      .from('profiles').select('trial_ends_at').eq('user_id', user_id).maybeSingle()

    const current = profile?.trial_ends_at ? new Date(profile.trial_ends_at).getTime() : 0
    const base = Math.max(Date.now(), Number.isFinite(current) ? current : 0)
    const next = new Date(base + n * 24 * 60 * 60 * 1000).toISOString()

    const { error } = await admin.from('profiles').update({ trial_ends_at: next }).eq('user_id', user_id)
    if (error) {
      console.error('extend_trial failed:', error)
      return NextResponse.json({ error: `Could not extend the trial: ${error.message}` }, { status: 500 })
    }

    await auditLog(admin, {
      actorUserId: user?.id, actorEmail: user?.email,
      action: 'extend_trial', targetUserId: user_id,
      detail: { days: n, from: profile?.trial_ends_at ?? null, to: next },
    })
    return NextResponse.json({ success: true, trial_ends_at: next })
  }

  // Suspend or unsuspend a team.
  //
  // Puts a notice on every card in the team. Deliberately does NOT take them
  // offline: the cards keep opening, saving and scanning. The notice is the
  // point, because it makes the person carrying the card ask their finance
  // team what is going on, and their staff chasing it internally collects far
  // better than we ever will chasing invoices.
  //
  // Never automatic. "Unpaid" is a judgement call, and a corporate 40 days
  // late on a debit order is normal.
  if (action === 'set_org_suspended') {
    const { org_id, suspended, message } = body
    if (!org_id) return NextResponse.json({ error: 'org_id required' }, { status: 400 })

    const { error } = await admin.from('organizations').update({
      suspended_at: suspended ? new Date().toISOString() : null,
      suspension_message: suspended ? (message || null) : null,
      updated_at: new Date().toISOString(),
    }).eq('id', org_id)
    if (error) {
      console.error('set_org_suspended failed:', error)
      return NextResponse.json({ error: `Could not do that: ${error.message}` }, { status: 500 })
    }

    await auditLog(admin, {
      actorUserId: user?.id, actorEmail: user?.email,
      action: suspended ? 'suspend_org' : 'unsuspend_org',
      detail: { org_id, message: message || null },
    })
    return NextResponse.json({ success: true })
  }

  // Record that a debit-order team was actually collected from.
  //
  // Nothing collects automatically, so without this a team can go months
  // unbilled and nothing would notice.
  if (action === 'mark_collected') {
    const { org_id } = body
    if (!org_id) return NextResponse.json({ error: 'org_id required' }, { status: 400 })
    const today = new Date().toISOString().slice(0, 10)
    const { error } = await admin.from('organizations').update({ last_collected_on: today }).eq('id', org_id)
    if (error) {
      console.error('mark_collected failed:', error)
      return NextResponse.json({ error: `Could not record that: ${error.message}` }, { status: 500 })
    }
    await auditLog(admin, {
      actorUserId: user?.id, actorEmail: user?.email,
      action: 'mark_collected', detail: { org_id, on: today },
    })
    return NextResponse.json({ success: true, last_collected_on: today })
  }

  // Create or update a sales rep.
  if (action === 'upsert_rep') {
    const { rep_id, name, email, phone, target_cards, commission_rand, active, started_on, notes } = body
    if (!name || !String(name).trim()) {
      return NextResponse.json({ error: 'Rep name is required' }, { status: 400 })
    }
    const target = Number(target_cards ?? 250)
    const rate = Number(commission_rand ?? 10)
    if (!Number.isInteger(target) || target < 0) {
      return NextResponse.json({ error: 'Target must be a whole number of 0 or more' }, { status: 400 })
    }
    if (!Number.isInteger(rate) || rate < 0) {
      return NextResponse.json({ error: 'Commission must be a whole number of rand, 0 or more' }, { status: 400 })
    }

    const patch = {
      name: String(name).trim(),
      email: email || null,
      phone: phone || null,
      target_cards: target,
      commission_rand: rate,
      active: active !== false,
      started_on: started_on || null,
      notes: notes || null,
      updated_at: new Date().toISOString(),
    }

    const { data, error } = rep_id
      ? await admin.from('reps').update(patch).eq('id', rep_id).select('id').maybeSingle()
      : await admin.from('reps').insert(patch).select('id').maybeSingle()
    if (error) {
      console.error('upsert_rep failed:', error)
      return NextResponse.json({ error: `Could not save the rep: ${error.message}` }, { status: 500 })
    }

    await auditLog(admin, {
      actorUserId: user?.id, actorEmail: user?.email,
      action: rep_id ? 'update_rep' : 'create_rep',
      detail: { rep_id: rep_id || data?.id, name: patch.name, target, rate },
    })
    return NextResponse.json({ success: true, rep_id: data?.id || rep_id })
  }

  // Link a client to a rep, or unlink (rep_id: null).
  //
  // Attribution decides who gets paid, so it is logged like any other action
  // that moves money.
  if (action === 'assign_rep') {
    const { rep_id, user_id, org_id } = body
    if (!user_id && !org_id) {
      return NextResponse.json({ error: 'Pass a user_id or an org_id' }, { status: 400 })
    }
    if (user_id && org_id) {
      return NextResponse.json({ error: 'Pass one of user_id or org_id, not both' }, { status: 400 })
    }

    const table = org_id ? 'organizations' : 'profiles'
    const match = org_id ? { id: org_id } : { user_id }
    const { error } = await admin.from(table).update({ rep_id: rep_id || null }).match(match)
    if (error) {
      console.error('assign_rep failed:', error)
      return NextResponse.json({ error: `Could not assign: ${error.message}` }, { status: 500 })
    }

    await auditLog(admin, {
      actorUserId: user?.id, actorEmail: user?.email,
      action: rep_id ? 'assign_rep' : 'unassign_rep',
      targetUserId: user_id || null,
      detail: { rep_id: rep_id || null, org_id: org_id || null },
    })
    return NextResponse.json({ success: true })
  }

  // Create or update a team.
  //
  // billing_period is what decides whether this team shows up as revenue, so
  // it is set explicitly here rather than defaulted to 'monthly' and forgotten
  // (which is how Cardtly's own 50-seat org came to report R4,850/month).
  if (action === 'create_org') {
    const { user_id, org_name, seat_count, billing_period, billing_notes, trial_ends_at } = body

    // Seats drive what the team can actually do (team/route.ts blocks
    // adding cards past max_seats), so refuse junk rather than writing
    // it. Admin deliberately has no upper bound: comped and enterprise
    // orgs sit above the 20-seat self-serve cap on purpose.
    const seats = Number(seat_count)
    if (!user_id) {
      return NextResponse.json({ error: 'Pick which user owns this team' }, { status: 400 })
    }
    if (!Number.isInteger(seats) || seats < 1) {
      return NextResponse.json({ error: 'Seat count must be a whole number of 1 or more' }, { status: 400 })
    }
    if (!org_name || !String(org_name).trim()) {
      return NextResponse.json({ error: 'Org name is required' }, { status: 400 })
    }
    const billing = billing_period || 'monthly'
    if (!(ORG_BILLING_MODES as readonly string[]).includes(billing)) {
      return NextResponse.json({ error: `Unknown billing mode "${billing}"` }, { status: 400 })
    }
    // Paystack self-serve tops out at 20 seats. Above that it is not billed
    // through Paystack at all, so calling it 'monthly' would claim we are
    // collecting money that nothing collects.
    // A trial with no end date is not a trial, it is a comp nobody wrote down.
    if (billing === 'trial' && !trial_ends_at) {
      return NextResponse.json({ error: 'A team trial needs an end date, otherwise it is just a comp' }, { status: 400 })
    }
    if (seats > MAX_SELF_SERVE_SEATS && (billing === 'monthly' || billing === 'yearly')) {
      return NextResponse.json({
        error: `${seats} seats is above the ${MAX_SELF_SERVE_SEATS}-seat Paystack limit. Set billing to Debit order (Enterprise) or Comped.`,
      }, { status: 400 })
    }

    // maybeSingle, not single: single throws on zero rows, and the error was
    // discarded, so this only worked by accident.
    const { data: existing } = await admin.from('organizations').select('id').eq('admin_user_id', user_id).maybeSingle()

    // Both branches capture their error. This used to return
    // success: true unconditionally, so a failed write reported
    // "Team plan set up" while doing nothing.
    if (existing) {
      const { error } = await admin.from('organizations').update({
        name: org_name,
        max_seats: seats,
        billing_period: billing,
        billing_notes: billing_notes ?? null,
        trial_ends_at: billing === 'trial' ? trial_ends_at : null,
        business_plan_active: true,
        updated_at: new Date().toISOString(),
      }).eq('id', existing.id)
      if (error) {
        console.error('admin create_org update failed:', error)
        return NextResponse.json({ error: `Could not update team: ${error.message}` }, { status: 500 })
      }
    } else {
      const { error } = await admin.from('organizations').insert({
        admin_user_id: user_id,
        name: org_name,
        max_seats: seats,
        used_seats: 0,
        business_plan_active: true,
        billing_period: billing,
        billing_notes: billing_notes ?? null,
        trial_ends_at: billing === 'trial' ? trial_ends_at : null,
      })
      if (error) {
        console.error('admin create_org insert failed:', error)
        return NextResponse.json({ error: `Could not create team: ${error.message}` }, { status: 500 })
      }
    }
    return NextResponse.json({ success: true })
  }

  // Update NFC order status.
  //
  // Three bugs here, all fixed:
  //  - `tracking_number: tracking_number || null` WIPED the tracking number
  //    whenever the caller did not resend it, which the status buttons never
  //    did. Marking an already-shipped order "shipped" again erased it, and
  //    the UI kept displaying the number until reload. Now the field is only
  //    written when it is actually supplied.
  //  - the error was never captured, so it always returned success.
  //  - `status` was unvalidated: any string went straight into the column.
  if (action === 'update_nfc_status') {
    const { order_id, status, tracking_number } = body
    if (!order_id) return NextResponse.json({ error: 'order_id required' }, { status: 400 })
    if (!(NFC_STATUSES as readonly string[]).includes(status)) {
      return NextResponse.json({ error: `Unknown status "${status}". Expected one of: ${NFC_STATUSES.join(', ')}` }, { status: 400 })
    }

    const patch: Record<string, any> = { status, updated_at: new Date().toISOString() }
    // Only touch tracking when the caller actually sent one. Sending an empty
    // string is how you deliberately clear it.
    if (typeof tracking_number === 'string') patch.tracking_number = tracking_number.trim() || null
    if (status === 'shipped') patch.shipped_at = new Date().toISOString()

    const { error } = await admin.from('nfc_orders').update(patch).eq('id', order_id)
    if (error) {
      console.error('update_nfc_status failed:', error)
      return NextResponse.json({ error: `Could not update the order: ${error.message}` }, { status: 500 })
    }

    await auditLog(admin, {
      actorUserId: user?.id, actorEmail: user?.email,
      action: 'update_nfc_status', detail: { order_id, status, tracking_touched: typeof tracking_number === 'string' },
    })
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
