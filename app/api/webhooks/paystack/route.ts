import { PROMOS_ENABLED } from '@/lib/promos'
import { NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import { logSubscriptionChange } from '@/lib/subscription-audit'
import { findActivePaystackSubs } from '@/lib/paystack'
import { paystackCancellation } from '@/lib/subscription-cancel'

export async function POST(request: Request) {
  try {
    const body = await request.text()
    const signature = request.headers.get('x-paystack-signature')

    // Verify webhook signature
    const hash = crypto
      .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY!)
      .update(body)
      .digest('hex')

    if (hash !== signature) {
      console.error('Invalid Paystack webhook signature')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const event = JSON.parse(body)
    console.log('Paystack webhook event:', event.event)

    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    ) as any

    // Successful charge - keep Pro active. Delete-then-insert because
    // whop_subscriptions has no unique constraint on user_id, so the
    // upsert(..., { onConflict: 'user_id' }) form errors out and
    // silently leaves the user on Free.
    if (event.event === 'charge.success') {
      const { customer, metadata, subscription_code, amount, paid_at } = event.data
      const userId = metadata?.user_id

      if (userId) {
        // Read before the delete, so the log can say what was replaced rather
        // than only what it became.
        const { data: prior } = await admin
          .from('whop_subscriptions').select('*').eq('user_id', userId).maybeSingle()

        await admin.from('whop_subscriptions').delete().eq('user_id', userId)
        await admin.from('whop_subscriptions').insert({
          user_id: userId,
          email: customer.email,
          plan_id: `paystack_${metadata?.plan || 'monthly'}`,
          subscription_tier: 'pro',
          billing_cycle: metadata?.plan || 'monthly',
          status: 'active',
          membership_id: subscription_code || event.data.reference,
          receipt_id: event.data.reference,
          seats: 1,
          metadata: {
            paystack_subscription_code: subscription_code,
            amount,
            paid_at,
          },
        })

        // No actor: Paystack did this, not a person. That is exactly what the
        // source field is for - without it a webhook activation and an admin
        // comping somebody read identically in the log.
        await logSubscriptionChange(admin, {
          change: 'activated', userId, email: customer.email,
          source: 'paystack_webhook', reason: 'charge.success',
          before: prior,
          after: { plan_id: `paystack_${metadata?.plan || 'monthly'}`, status: 'active',
                   subscription_tier: 'pro', billing_cycle: metadata?.plan || 'monthly', seats: 1 },
        })

        // Promotions: grant a 'paid' draw entry. Idempotent via the
        // Paystack reference so a retried webhook can't double-grant.
        // Capped at 10 total entries per user inside grant-entry.
        // Skipped entirely while promos are paused.
        if (PROMOS_ENABLED) try {
          const paidIdemKey = `paid:${event.data.reference}`
          // Count check first - skip the API call if at cap to save a hop
          const { count: entryCount } = await admin
            .from('promo_entries')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', userId)
          if ((entryCount ?? 0) < 10) {
            await admin.from('promo_entries').insert({
              user_id: userId,
              source: 'paid',
              idempotency_key: paidIdemKey,
            })
          }
        } catch {
          // Don't fail the webhook if entry grant errors - the
          // subscription is the important part.
        }

        // Promotions: if this user was referred by someone, mark
        // the referral as 'paid' and grant the referrer an entry
        // (also idempotent, also capped at 10). The 30-day-paid
        // verification will be enforced later by a daily cron;
        // for now we treat first paid as eligible.
        try {
          const { data: referralRow } = await admin
            .from('referrals')
            .select('id, referrer_user_id, became_paid_at')
            .eq('referred_user_id', userId)
            .maybeSingle()

          if (referralRow && !referralRow.became_paid_at) {
            await admin.from('referrals').update({
              status: 'paid',
              became_paid_at: new Date().toISOString(),
            }).eq('id', referralRow.id)

            // Referral tracking above still runs while promos are
            // paused (it's just attribution data, and it's worth having
            // whenever we decide what to do next). Only the draw entry,
            // which is the actual prize mechanic, is gated.
            if (PROMOS_ENABLED) {
              const referrerEntryKey = `referral:${referralRow.id}`
              const { count: refEntryCount } = await admin
                .from('promo_entries')
                .select('id', { count: 'exact', head: true })
                .eq('user_id', referralRow.referrer_user_id)
              if ((refEntryCount ?? 0) < 10) {
                await admin.from('promo_entries').insert({
                  user_id: referralRow.referrer_user_id,
                  source: 'referral',
                  idempotency_key: referrerEntryKey,
                })
              }
            }
          }
        } catch {
          // Same - don't fail the webhook on entry-grant errors
        }
      } else {
        // No user_id in the metadata. That metadata is attached when the
        // customer first checks out, so every later charge on the same
        // subscription - every renewal, and every successful retry after a
        // decline - arrives without it and used to fall straight through this
        // handler doing nothing. The row therefore stayed past_due after
        // Paystack had actually been paid, and the card went dark at the end
        // of the grace window despite the money having arrived.
        //
        // Recover by email, the same key the cancellation events and
        // invoice.payment_failed already use.
        const { data: existing } = await admin
          .from('whop_subscriptions')
          .select('user_id')
          .eq('email', customer.email)
          .maybeSingle()

        if (existing) {
          await admin.from('whop_subscriptions').update({
            status: 'active',
            past_due_since: null,
            // Cleared with it, so a failure months from now warns again rather
            // than being silently treated as already-notified.
            past_due_email_sent_at: null,
            updated_at: new Date().toISOString(),
          }).eq('user_id', existing.user_id)

          await logSubscriptionChange(admin, {
            change: 'updated', userId: existing.user_id, email: customer.email,
            source: 'paystack_webhook', reason: 'charge.success recovered a past_due row by email',
            after: { status: 'active' },
          })
        } else {
          console.error('Paystack charge.success with no user_id and no row for', customer.email)
        }
      }
    }

    // Cancelled at Paystack. This used to listen for 'subscription.disabled',
    // an event Paystack does not send (it is 'subscription.disable'), so a
    // cancellation made in the Paystack dashboard, or by the customer on
    // Paystack's own manage-subscription page, never reached Cardtly and that
    // customer kept Pro indefinitely. It also set status 'cancelled' outright,
    // which would have cut off the rest of a period already paid for.
    //
    // Now both real events only record cancel_at: see paystackCancellation for
    // what each one means and for the resubscribe case it must not trip over.
    if (event.event === 'subscription.not_renew' || event.event === 'subscription.disable') {
      const kind = event.event === 'subscription.disable' ? 'disable' : 'not_renew'
      const data = event.data || {}
      const code: string | null = data.subscription_code || null
      const email: string = data.customer?.email || ''

      const row = await subscriptionRowFor(admin, code, email)
      let decision = paystackCancellation(kind, data, row, [])

      // Only a row we would act on is worth a Paystack call: is this customer
      // still billed on some OTHER subscription? If Paystack cannot answer,
      // fail the webhook so Paystack retries, rather than guess.
      if (decision.action === 'set' && email) {
        const live = await findActivePaystackSubs(email)
        if (!live.ok) {
          console.error('Paystack', event.event, 'could not list live subscriptions:', live.error)
          return NextResponse.json({ error: 'Could not confirm live subscriptions' }, { status: 503 })
        }
        decision = paystackCancellation(kind, data, row, live.subs.map(s => s.subscription_code))
      }

      if (decision.action === 'ignore') {
        console.log('Paystack', event.event, code, 'ignored:', decision.reason)
      } else {
        // Pinned to the exact row reasoned about. charge.success re-creates the
        // row on every payment, so a payment landing in between produces a new
        // created_at - and that customer has just paid.
        const { data: updated, error: writeErr } = await admin
          .from('whop_subscriptions')
          .update({ cancel_at: decision.cancelAt, updated_at: new Date().toISOString() })
          .eq('user_id', row.user_id)
          .eq('created_at', row.created_at)
          .in('status', ['active', 'past_due'])
          .select('user_id')
        if (writeErr) throw writeErr

        if (updated?.length) {
          await logSubscriptionChange(admin, {
            change: 'updated', userId: row.user_id, email: row.email || email,
            source: 'paystack_webhook',
            reason: `${event.event} for ${code || 'unknown code'}: serves until ${decision.cancelAt}.`,
            before: row, after: { ...row, cancel_at: decision.cancelAt },
          })
        }
      }
    }

    // Subscription not renewing
    if (event.event === 'invoice.payment_failed') {
      const { customer } = event.data

      const { data: sub } = await admin
        .from('whop_subscriptions')
        .select('user_id, past_due_since')
        .eq('email', customer.email)
        .maybeSingle()

      if (sub) {
        // coalesce, so a second failed retry does not restart the grace clock
        // and hand out another full window.
        await admin.from('whop_subscriptions').update({
          status: 'past_due',
          past_due_since: sub.past_due_since ?? new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq('user_id', sub.user_id)

        await logSubscriptionChange(admin, {
          change: 'updated', userId: sub.user_id, email: customer.email,
          source: 'paystack_webhook', reason: 'invoice.payment_failed, grace window running',
          after: { status: 'past_due' },
        })
      }
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}

// The live row a Paystack subscription event is about: by subscription code
// when we happen to have stored one, otherwise by the customer's email, the key
// the other branches here use. A read error throws, so Paystack retries rather
// than the event being dropped as "no such customer".
async function subscriptionRowFor(admin: any, code: string | null, email: string): Promise<any | null> {
  const cols = 'user_id, email, plan_id, status, billing_cycle, created_at, metadata, membership_id, seats, cancel_at'
  const latestLive = (q: any) => q
    .in('status', ['active', 'past_due'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (code) {
    const { data, error } = await latestLive(
      admin.from('whop_subscriptions').select(cols).eq('metadata->>paystack_subscription_code', code))
    if (error) throw error
    if (data) return data
  }
  if (!email) return null
  const { data, error } = await latestLive(admin.from('whop_subscriptions').select(cols).eq('email', email))
  if (error) throw error
  return data
}
