import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
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
    const supabase = await createClient()

    console.log('Paystack webhook event:', event.event)

    switch (event.event) {

      // Successful charge — activate or renew subscription
      case 'charge.success': {
        const { customer, reference, metadata, amount, paid_at } = event.data
        const userId = metadata?.user_id
        const plan = metadata?.plan || 'monthly'

        if (!userId) {
          console.error('No user_id in charge.success metadata')
          break
        }

        const periodEnd = new Date()
        if (plan === 'monthly') {
          periodEnd.setMonth(periodEnd.getMonth() + 1)
        } else {
          periodEnd.setFullYear(periodEnd.getFullYear() + 1)
        }

        await supabase.from('whop_subscriptions').upsert({
          user_id: userId,
          email: customer.email,
          plan_id: `paystack_${plan}`,
          subscription_tier: 'pro',
          billing_cycle: plan,
          status: 'active',
          receipt_id: reference,
          membership_id: reference,
          metadata: {
            paystack_reference: reference,
            amount,
            period_end: periodEnd.toISOString(),
            paid_at,
          },
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' })

        break
      }

      // Subscription cancelled — keep Pro until period end
      case 'subscription.disable':
      case 'subscription.not_renew': {
        const { customer, metadata } = event.data
        const userId = metadata?.user_id

        if (!userId) break

        // Mark as cancelled but keep status active until period_end
        // The metadata already has period_end from the last successful charge
        await supabase
          .from('whop_subscriptions')
          .update({
            status: 'cancelled',
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId)

        break
      }

      // Invoice failed — payment couldn't renew
      case 'invoice.payment_failed': {
        const { customer, metadata } = event.data
        const userId = metadata?.user_id

        if (!userId) break

        // Check if period_end has passed — if so, downgrade
        const { data: sub } = await supabase
          .from('whop_subscriptions')
          .select('metadata')
          .eq('user_id', userId)
          .single()

        if (sub?.metadata?.period_end) {
          const periodEnd = new Date(sub.metadata.period_end)
          if (new Date() > periodEnd) {
            await supabase
              .from('whop_subscriptions')
              .update({
                status: 'expired',
                subscription_tier: 'free',
                updated_at: new Date().toISOString(),
              })
              .eq('user_id', userId)
          }
        }

        break
      }

      default:
        console.log('Unhandled Paystack event:', event.event)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}
