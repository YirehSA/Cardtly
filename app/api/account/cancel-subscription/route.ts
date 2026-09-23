import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { cancelSubscriptionsFor, findActivePaystackSubs, subscriptionCodeOf } from '@/lib/paystack'
import { cancellationEndsAt } from '@/lib/subscription-cancel'
import { logSubscriptionChange } from '@/lib/subscription-audit'
import { renderSubscriptionCancelledEmail } from '@/lib/billing-email-templates'
import { FROM_EMAIL } from '@/lib/email'

// SELF-SERVICE CANCELLATION.
//
// Cancelling used to be "get in touch and we will sort it out": Settings'
// Manage subscription button went to the contact page. This stops future
// Paystack charges and lets the card keep serving until the end of the period
// already paid for, which is what the Terms promise.
//
// WHO IT IS FOR: someone paying for their own card through Paystack. Every
// subscription this site's own checkout creates is single-seat (the verify
// route and charge.success both write seats: 1). Team seats and invoiced
// organisations are billed differently and affect other people's cards, so
// they are refused here with a pointer to the contact page rather than guessed
// at.
//
// THE ORDER IS THE POINT:
//   1. Read the row and make sure the date can be recorded at all. If migration
//      090 has not run there is no cancel_at column, and disabling Paystack
//      without being able to record the end date would leave a row that serves
//      forever for free. So that is checked before anything is touched.
//   2. Ask Paystack for the next charge date BEFORE disabling - afterwards it no
//      longer lists the subscription as live and has no date to give.
//   3. Disable at Paystack. If that fails, nothing has changed; say so.
//   4. Record cancel_at. If THIS fails, Paystack has already stopped billing,
//      so the customer is told exactly that; a retry takes the paid_at path in
//      cancellationEndsAt and still records the right date.
//   5. Log it, then email a confirmation. Neither can fail the request: the
//      cancellation has happened, and a failure after the fact invites a retry
//      of something destructive.

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  ) as any
}

const CONTACT = 'Email andre@cardtly.com and we will cancel it for you.'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

  const db = admin()

  // 1. The row, with every column, so the presence of cancel_at can be tested.
  const { data: row, error: readErr } = await db
    .from('whop_subscriptions')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (readErr) return NextResponse.json({ error: `We could not read your subscription. ${CONTACT}` }, { status: 500 })
  if (!row) return NextResponse.json({ error: 'There is no subscription on this account to cancel.' }, { status: 400 })

  if (!('cancel_at' in row)) {
    return NextResponse.json({ error: `Self-service cancellation is not switched on yet. ${CONTACT}` }, { status: 503 })
  }

  if (row.billing_cycle === 'comp' || row.metadata?.comped) {
    return NextResponse.json({ error: 'This account is on Cardtly at no charge, so there is nothing to cancel.' }, { status: 400 })
  }

  const isPaystack = String(row.plan_id || '').startsWith('paystack')
  const isLive = row.status === 'active' || row.status === 'past_due'
  if (!isPaystack || !isLive || (row.seats && row.seats > 1)) {
    return NextResponse.json({
      error: `This subscription is billed in a way that has to be cancelled by us, because it covers more than your own card. ${CONTACT}`,
    }, { status: 400 })
  }

  // Already cancelled and still inside the paid period: say so, change nothing.
  // Pressing the button twice must not move the date or send a second email.
  if (row.cancel_at && new Date(row.cancel_at).getTime() > Date.now()) {
    return NextResponse.json({ ok: true, cancelAt: row.cancel_at, alreadyCancelled: true })
  }

  const billingEmail = row.email || user.email || ''

  // 2. When the paid period ends, from Paystack, while it still knows.
  const live = await findActivePaystackSubs(billingEmail)
  if (!live.ok) {
    return NextResponse.json({
      error: `We could not reach our payment provider just now, so nothing has been cancelled. Please try again in a minute, or ${CONTACT.charAt(0).toLowerCase()}${CONTACT.slice(1)}`,
    }, { status: 502 })
  }
  const cancelAt = cancellationEndsAt(row, live.subs.map(s => s.next_payment_date))

  // 3. Stop the billing.
  const result = await cancelSubscriptionsFor(billingEmail, subscriptionCodeOf(row))
  if (!result.ok) {
    await logSubscriptionChange(db, {
      change: 'updated', userId: user.id, email: billingEmail,
      actorUserId: user.id, actorEmail: user.email,
      source: 'self_service_cancel', reason: `Paystack disable failed, nothing changed: ${result.error}`,
      before: row, after: row,
    }).catch(() => {})
    return NextResponse.json({
      error: `We could not cancel with our payment provider just now, so nothing has changed and you will not lose anything. Please try again shortly, or ${CONTACT.charAt(0).toLowerCase()}${CONTACT.slice(1)}`,
    }, { status: 502 })
  }

  // 4. Record when the card stops.
  const { error: writeErr } = await db
    .from('whop_subscriptions')
    .update({ cancel_at: cancelAt, updated_at: new Date().toISOString() })
    .eq('user_id', user.id)

  if (writeErr) {
    await logSubscriptionChange(db, {
      change: 'updated', userId: user.id, email: billingEmail,
      actorUserId: user.id, actorEmail: user.email,
      source: 'self_service_cancel',
      reason: `Paystack billing STOPPED (${result.cancelled.join(', ') || 'none live'}) but cancel_at could not be recorded: ${writeErr.message}. Should end ${cancelAt}.`,
      before: row, after: row,
    }).catch(() => {})
    return NextResponse.json({
      error: `Your billing has been stopped and you will not be charged again, but we could not record the date your card goes offline. Please press Cancel once more, or ${CONTACT.charAt(0).toLowerCase()}${CONTACT.slice(1)}`,
    }, { status: 500 })
  }

  // 5. The record, then the confirmation. Neither can undo step 3.
  await logSubscriptionChange(db, {
    change: 'updated', userId: user.id, email: billingEmail,
    actorUserId: user.id, actorEmail: user.email,
    source: 'self_service_cancel',
    reason: `Cancelled by the account holder. Paystack disabled: ${result.cancelled.join(', ') || 'none still billing'}. Serves until ${cancelAt}.`,
    before: row, after: { ...row, cancel_at: cancelAt },
  }).catch(() => {})

  try {
    const key = process.env.RESEND_API_KEY
    if (key && billingEmail) {
      const [{ data: profile }, { data: card }] = await Promise.all([
        db.from('profiles').select('name').eq('user_id', user.id).maybeSingle(),
        db.from('cards').select('slug').eq('user_id', user.id).order('is_primary', { ascending: false }).limit(1).maybeSingle(),
      ])
      const firstName = String(profile?.name || '').trim().split(/\s+/)[0] || ''
      const { subject, html } = renderSubscriptionCancelledEmail({ firstName, slug: card?.slug || null, liveUntil: cancelAt })
      await new Resend(key).emails.send({ from: FROM_EMAIL, to: billingEmail, subject, html })
    }
  } catch {
    // The cancellation stands. The confirmation is a courtesy.
  }

  return NextResponse.json({ ok: true, cancelAt })
}
