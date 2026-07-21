import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { isAdminUser, FOUNDER_ADMIN_USER_ID } from '@/lib/admin-check'
import { sendPasswordResetEmail } from '@/lib/password-reset'
import { auditLog } from '@/lib/admin-audit'
import { cancelSubscriptionsFor, subscriptionCodeOf, isBillablePaystackSub } from '@/lib/paystack'
import { NFC_STATUSES } from '@/lib/nfc'
import { ORG_BILLING_MODES, MAX_SELF_SERVE_SEATS, orgBillingStartsInDays } from '@/lib/org-billing'
import { findUserByEmail } from '@/lib/department-perms'
import { sendTeamOwnerWelcome } from '@/lib/team-owner-invite'

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
  // ── Departments ─────────────────────────────────────────────────────────
  // Structure only here: create, rename, delete, assign a manager, move a
  // card in. The department's LOOK is edited by its manager in the dashboard,
  // so there is no brand editor in the admin.

  if (action === 'create_department') {
    const { org_id, name } = body
    if (!org_id || !name || !String(name).trim()) {
      return NextResponse.json({ error: 'A team and a department name are required' }, { status: 400 })
    }
    const { data, error } = await admin.from('departments')
      .insert({ organization_id: org_id, name: String(name).trim() })
      .select('id').maybeSingle()
    if (error) {
      console.error('create_department failed:', error)
      return NextResponse.json({ error: `Could not create it: ${error.message}` }, { status: 500 })
    }
    await auditLog(admin, { actorUserId: user?.id, actorEmail: user?.email, action: 'create_department', detail: { org_id, name, department_id: data?.id } })
    return NextResponse.json({ success: true, department_id: data?.id })
  }

  if (action === 'rename_department') {
    const { department_id, name } = body
    if (!department_id || !name || !String(name).trim()) {
      return NextResponse.json({ error: 'A department and a name are required' }, { status: 400 })
    }
    const { error } = await admin.from('departments')
      .update({ name: String(name).trim(), updated_at: new Date().toISOString() })
      .eq('id', department_id)
    if (error) return NextResponse.json({ error: `Could not rename: ${error.message}` }, { status: 500 })
    await auditLog(admin, { actorUserId: user?.id, actorEmail: user?.email, action: 'rename_department', detail: { department_id, name } })
    return NextResponse.json({ success: true })
  }

  if (action === 'delete_department') {
    const { department_id } = body
    if (!department_id) return NextResponse.json({ error: 'department_id required' }, { status: 400 })
    // ON DELETE SET NULL on team_cards.department_id, so the cards survive and
    // fall back to the org brand. Nobody loses a card by this.
    const { count } = await admin.from('team_cards').select('id', { count: 'exact', head: true }).eq('department_id', department_id)
    const { error } = await admin.from('departments').delete().eq('id', department_id)
    if (error) return NextResponse.json({ error: `Could not delete: ${error.message}` }, { status: 500 })
    await auditLog(admin, { actorUserId: user?.id, actorEmail: user?.email, action: 'delete_department', detail: { department_id, cards_freed: count ?? 0 } })
    return NextResponse.json({ success: true, cardsFreed: count ?? 0 })
  }

  if (action === 'set_dept_manager') {
    // add or remove (manage = false).
    const { department_id, user_id, manage } = body
    if (!department_id || !user_id) return NextResponse.json({ error: 'department_id and user_id required' }, { status: 400 })
    if (manage === false) {
      const { error } = await admin.from('department_managers').delete().eq('department_id', department_id).eq('user_id', user_id)
      if (error) return NextResponse.json({ error: `Could not remove: ${error.message}` }, { status: 500 })
      await auditLog(admin, { actorUserId: user?.id, actorEmail: user?.email, action: 'remove_dept_manager', targetUserId: user_id, detail: { department_id } })
      return NextResponse.json({ success: true })
    }
    // Idempotent: unique(department_id, user_id) means a repeat is harmless.
    const { error } = await admin.from('department_managers')
      .upsert({ department_id, user_id }, { onConflict: 'department_id,user_id' })
    if (error) return NextResponse.json({ error: `Could not assign: ${error.message}` }, { status: 500 })
    await auditLog(admin, { actorUserId: user?.id, actorEmail: user?.email, action: 'assign_dept_manager', targetUserId: user_id, detail: { department_id } })
    return NextResponse.json({ success: true })
  }

  if (action === 'move_card_to_department') {
    const { team_card_id, department_id } = body
    if (!team_card_id) return NextResponse.json({ error: 'team_card_id required' }, { status: 400 })
    // department_id null moves the card back to the org level.
    const { error } = await admin.from('team_cards')
      .update({ department_id: department_id || null })
      .eq('id', team_card_id)
    if (error) return NextResponse.json({ error: `Could not move it: ${error.message}` }, { status: 500 })
    await auditLog(admin, { actorUserId: user?.id, actorEmail: user?.email, action: 'move_card_to_department', detail: { team_card_id, department_id: department_id || null } })
    return NextResponse.json({ success: true })
  }

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
    const { rep_id, name, email, phone, target_cards, commission_rand, commission_day, active, started_on, notes } = body
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
    // Capped at 28 so a period boundary exists in February. Beyond that the
    // period would silently skip a month.
    const day = Number(commission_day ?? 25)
    if (!Number.isInteger(day) || day < 1 || day > 28) {
      return NextResponse.json({ error: 'Commission day must be between 1 and 28, so the period always has a boundary in February' }, { status: 400 })
    }

    const patch = {
      name: String(name).trim(),
      email: email || null,
      phone: phone || null,
      target_cards: target,
      commission_rand: rate,
      commission_day: day,
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

  // Freeze what a rep is owed for a period.
  //
  // This exists because the figure cannot be recomputed later.
  // whop_subscriptions has no history: a row that goes active -> cancelled is
  // UPDATED in place, so once the period closes and a client churns, "what was
  // the paying base on the 25th" is gone. Recording it is the only record
  // there will ever be.
  //
  // The client sends what it displayed, but the server recomputes and stores
  // its own numbers. A stale tab must not be able to write a commission figure.
  if (action === 'record_payout') {
    const { rep_id, period_start, period_end, paying_cards, target_cards, billable_cards, rate_rand, commission_rand, paid, notes } = body
    if (!rep_id || !period_start || !period_end) {
      return NextResponse.json({ error: 'rep_id and the period are required' }, { status: 400 })
    }
    for (const [label, v] of [['paying', paying_cards], ['target', target_cards], ['billable', billable_cards], ['rate', rate_rand], ['commission', commission_rand]]) {
      if (!Number.isInteger(Number(v)) || Number(v) < 0) {
        return NextResponse.json({ error: `${label} must be a whole number of 0 or more` }, { status: 400 })
      }
    }

    const { error } = await admin.from('rep_payouts').insert({
      rep_id,
      period_start,
      period_end,
      paying_cards: Number(paying_cards),
      target_cards: Number(target_cards),
      billable_cards: Number(billable_cards),
      rate_rand: Number(rate_rand),
      commission_rand: Number(commission_rand),
      paid_at: paid ? new Date().toISOString() : null,
      notes: notes || null,
    })
    if (error) {
      // unique (rep_id, period_start): recording twice is a mistake, not a
      // top-up, so it fails loudly rather than double-paying.
      if (error.code === '23505') {
        return NextResponse.json({ error: 'This period is already recorded for that rep. Recording it twice would double-pay.' }, { status: 409 })
      }
      console.error('record_payout failed:', error)
      return NextResponse.json({ error: `Could not record it: ${error.message}` }, { status: 500 })
    }

    await auditLog(admin, {
      actorUserId: user?.id, actorEmail: user?.email,
      action: 'record_payout',
      detail: { rep_id, period_start, period_end, commission_rand, paid: !!paid },
    })
    return NextResponse.json({ success: true })
  }

  // Delete a rep.
  //
  // The FK is ON DELETE SET NULL, so this can never cascade into a customer's
  // profile or a company's team: it only unassigns them. Verified against the
  // live DB. But unassigning is still a silent loss of who signed what, so a
  // rep with clients is refused unless forced, and the count comes back so the
  // UI can say exactly what is about to be thrown away.
  //
  // Deactivating is usually the right move for a rep who left: it keeps the
  // attribution and stops them counting. Delete is for the one you created by
  // mistake.
  if (action === 'delete_rep') {
    const { rep_id, force } = body
    if (!rep_id) return NextResponse.json({ error: 'rep_id required' }, { status: 400 })

    const { data: rep } = await admin.from('reps').select('name').eq('id', rep_id).maybeSingle()
    if (!rep) return NextResponse.json({ error: 'That rep no longer exists' }, { status: 404 })

    const [{ count: people }, { count: teams }] = await Promise.all([
      admin.from('profiles').select('user_id', { count: 'exact', head: true }).eq('rep_id', rep_id),
      admin.from('organizations').select('id', { count: 'exact', head: true }).eq('rep_id', rep_id),
    ])
    const linked = (people ?? 0) + (teams ?? 0)

    if (linked > 0 && !force) {
      return NextResponse.json({
        error: `${rep.name} still has ${linked} client${linked === 1 ? '' : 's'} linked (${people ?? 0} personal, ${teams ?? 0} team). Deleting unassigns them and loses the record of who signed them. Deactivate instead to keep the history, or confirm to delete anyway.`,
        needsForce: true,
        linked,
      }, { status: 409 })
    }

    const { error } = await admin.from('reps').delete().eq('id', rep_id)
    if (error) {
      console.error('delete_rep failed:', error)
      return NextResponse.json({ error: `Could not delete: ${error.message}` }, { status: 500 })
    }

    await auditLog(admin, {
      actorUserId: user?.id, actorEmail: user?.email,
      action: 'delete_rep', detail: { rep_id, name: rep.name, unassigned: linked, forced: !!force },
    })
    return NextResponse.json({ success: true, unassigned: linked })
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
    const { user_id, owner_email, send_welcome, org_name, seat_count, billing_period, billing_notes, trial_ends_at, billing_starts_on } = body

    // Seats drive what the team can actually do (team/route.ts blocks
    // adding cards past max_seats), so refuse junk rather than writing
    // it. Admin deliberately has no upper bound: comped and enterprise
    // orgs sit above the 20-seat self-serve cap on purpose.
    const seats = Number(seat_count)
    const wantsNewOwner = !user_id && !!String(owner_email || '').trim()
    if (!user_id && !wantsNewOwner) {
      return NextResponse.json({ error: 'Pick who owns this team, or type their email address' }, { status: 400 })
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
    // The free run before an enterprise debit order starts. Only meaningful
    // for debit_order: on any other mode it would sit in the database looking
    // like a promise nothing keeps, so it is cleared rather than stored.
    let startsOn: string | null = billing === 'debit_order' ? (billing_starts_on || null) : null
    if (startsOn) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(startsOn) || Number.isNaN(new Date(startsOn).getTime())) {
        return NextResponse.json({ error: `"${startsOn}" is not a date` }, { status: 400 })
      }
      // A start date in the past means billing has already begun, which a null
      // says more honestly. Otherwise the team reads as being on a free run
      // that quietly finished. 0 is today and stays: that is the first
      // collection date, not the past.
      const days = orgBillingStartsInDays('debit_order', startsOn)
      if (days === null || days < 0) startsOn = null
    }

    // Who will own this. An enterprise client is signed before they have ever
    // touched the product, so the owner usually does not exist yet: the deal
    // is done over a call, and the first thing they should see is a working
    // team, not a signup form.
    //
    // Deliberately after every validation above. Creating the account first
    // would leave a real person with a real Cardtly login and no team behind
    // it every time a seat count or billing mode was rejected.
    let ownerId: string = user_id
    let createdAccount = false
    let ownerEmail = ''

    if (wantsNewOwner) {
      ownerEmail = String(owner_email).trim().toLowerCase()
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(ownerEmail)) {
        return NextResponse.json({ error: `"${ownerEmail}" does not look like an email address` }, { status: 400 })
      }
      // Reuse an existing account rather than failing on the duplicate. Typing
      // the email of somebody who already signed up is the likeliest way to
      // use this field, and it should just work.
      const existing = await findUserByEmail(admin, ownerEmail)
      if (existing) {
        ownerId = existing.id
      } else {
        // email_confirm: true because we are the ones vouching for the
        // address - we just agreed a contract against it. No password is set;
        // the welcome email below carries a link for them to choose one.
        const { data: created, error: createErr } = await admin.auth.admin.createUser({
          email: ownerEmail,
          email_confirm: true,
          user_metadata: { created_by: 'admin_team_setup' },
        })
        if (createErr || !created?.user) {
          console.error('create_org createUser failed:', createErr)
          return NextResponse.json({
            error: `Could not create an account for ${ownerEmail}: ${createErr?.message || 'unknown error'}`,
          }, { status: 500 })
        }
        ownerId = created.user.id
        createdAccount = true
      }
    }

    // maybeSingle, not single: single throws on zero rows, and the error was
    // discarded, so this only worked by accident.
    const { data: existing } = await admin.from('organizations').select('id').eq('admin_user_id', ownerId).maybeSingle()

    // Seats cannot be cut below the cards that already exist. Nothing deletes
    // cards to fit a smaller number, so the org would just sit over its cap:
    // every existing card keeps working, no error appears anywhere, and the
    // only symptom is that adding the next one fails with "seat limit
    // reached" on a team the admin believes has room. Refuse with the real
    // numbers instead, and let them remove cards first if they mean it.
    if (existing) {
      const { count: cardsCreated } = await admin
        .from('team_cards')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', existing.id)
      if ((cardsCreated || 0) > seats) {
        return NextResponse.json({
          error: `That team already has ${cardsCreated} cards, so it cannot drop to ${seats} seats. Remove ${(cardsCreated || 0) - seats} card${(cardsCreated || 0) - seats === 1 ? '' : 's'} first.`,
        }, { status: 400 })
      }
    }

    const fields: Record<string, any> = {
      name: org_name,
      max_seats: seats,
      billing_period: billing,
      billing_notes: billing_notes ?? null,
      trial_ends_at: billing === 'trial' ? trial_ends_at : null,
      billing_starts_on: startsOn,
      business_plan_active: true,
    }

    // Migrations here are applied by hand, after the deploy. Without this, the
    // window between pushing 043 and running it would break saving ANY team -
    // comps and monthlies included - with a 42703 about a column that has
    // nothing to do with them. Retry without it and say so, rather than
    // failing a seat change over an unrelated feature.
    async function write(): Promise<{ error: any; degraded: boolean }> {
      const run = (f: Record<string, any>) => existing
        ? admin.from('organizations').update({ ...f, updated_at: new Date().toISOString() }).eq('id', existing.id)
        : admin.from('organizations').insert({ ...f, admin_user_id: ownerId, used_seats: 0 })
      const { error } = await run(fields)
      if (error?.code !== '42703') return { error, degraded: false }
      const { billing_starts_on: _dropped, ...rest } = fields
      const { error: retryError } = await run(rest)
      return { error: retryError, degraded: !retryError }
    }

    // Both branches capture their error. This used to return
    // success: true unconditionally, so a failed write reported
    // "Team plan set up" while doing nothing.
    const { error, degraded } = await write()
    if (error) {
      console.error(`admin create_org ${existing ? 'update' : 'insert'} failed:`, error)
      return NextResponse.json({
        error: `Could not ${existing ? 'update' : 'create'} team: ${error.message}`
          // The account is real even though the team is not. Say so, otherwise
          // the next attempt looks like it is creating a duplicate.
          + (createdAccount ? ` The account for ${ownerEmail} was created and is still there - try again and it will be reused.` : ''),
      }, { status: 500 })
    }

    // Only now, with a team behind it. Sending "your team is ready" before the
    // org exists would be a lie told to a paying customer.
    const notes: string[] = []
    if (degraded) {
      notes.push('The debit order start date was not saved: migration 043 has not been run on this database yet.')
    }
    if (createdAccount) {
      if (send_welcome === false) {
        notes.push(`Account created for ${ownerEmail}. No email sent - they will need a password reset link before they can sign in.`)
      } else {
        const origin = new URL(request.url).origin
        const sent = await sendTeamOwnerWelcome(ownerEmail, String(org_name), seats, origin)
        notes.push(sent.ok
          ? `Account created and a set-your-password email sent to ${ownerEmail}.`
          : `Account created for ${ownerEmail}, but the email did NOT send (${sent.error || sent.reason}). Send them a password reset instead.`)
      }
      await auditLog(admin, {
        actorUserId: user?.id, actorEmail: user?.email,
        action: 'create_team_owner_account', targetUserId: ownerId,
        detail: { email: ownerEmail, org_name, seats },
      })
    } else if (wantsNewOwner) {
      notes.push(`${ownerEmail} already had an account, so the team was linked to it.`)
    }

    return NextResponse.json({
      success: true,
      ...(notes.length ? { warning: notes.join(' ') } : {}),
    })
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
