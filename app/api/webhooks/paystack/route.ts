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
        .select('user_id')
        .eq('email', customer.email)
        .single()

      if (sub) {
        await admin.from('whop_subscriptions').update({
          status: 'past_due',
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
