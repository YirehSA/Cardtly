import { PROMOS_ENABLED } from '@/lib/promos'
import { NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import crypto from 'crypto'

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
        // Recover by email, the same key subscription.disabled and
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
            updated_at: new Date().toISOString(),
          }).eq('user_id', existing.user_id)
        } else {
          console.error('Paystack charge.success with no user_id and no row for', customer.email)
        }
      }
    }

    // Subscription disabled — cancel Pro
    if (event.event === 'subscription.disabled') {
      const { customer } = event.data

      const { data: sub } = await admin
        .from('whop_subscriptions')
        .select('user_id')
        .eq('email', customer.email)
        .single()

      if (sub) {
        await admin.from('whop_subscriptions').update({
          status: 'cancelled',
          updated_at: new Date().toISOString(),
        }).eq('user_id', sub.user_id)
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
      }
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}
