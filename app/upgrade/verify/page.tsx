import { redirect } from 'next/navigation'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { logSubscriptionChange } from '@/lib/subscription-audit'
import { completeBundlePayment, isBundleTransaction, txMetadata } from '@/lib/pro-bundle-server'
import { planForActivation, planIdFor } from '@/lib/paid-plans'

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ reference?: string; trxref?: string; plan?: string; user_id?: string }>
}) {
  const { reference, trxref, plan, user_id } = await searchParams
  const ref = reference || trxref
  const billingPlan = plan || 'monthly'

  if (!ref || !user_id) {
    redirect('/upgrade/cancel?reason=missing_params')
  }

  // next/navigation's redirect() works by throwing a special error. If
  // the redirect() call is wrapped in a try/catch, the success redirect
  // gets caught and the user lands on /upgrade/cancel even though the
  // payment succeeded and the row was written. Do the verify + write
  // OUTSIDE the try, fall through to a top-level redirect, and only
  // catch the actual fetch/db errors.
  let verified = false
  let bundle = false
  // What was bought, read from the payment (lib/paid-plans): Pro or Solo.
  let boughtTier: 'pro' | 'solo' = 'pro'
  let boughtCycle: 'monthly' | 'yearly' = billingPlan === 'yearly' ? 'yearly' : 'monthly'
  try {
    const response = await fetch(`https://api.paystack.co/transaction/verify/${ref}`, {
      headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
      cache: 'no-store',
    })
    const data = await response.json()

    if (!data.status || data.data.status !== 'success') {
      redirect('/upgrade/cancel?reason=payment_failed')
    }

    const transaction = data.data

    // Service-role client - whop_subscriptions RLS blocks user-scoped
    // inserts, and only the server should be flipping users to Pro.
    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    ) as any

    if (isBundleTransaction(transaction)) {
      // The Pro year + NFC card bundle (R999) completes its own way: the card
      // order, the year of Pro and next year's renewal, once only however
      // many times this payment is reported. The user and the plan come from
      // the payment itself, not from this URL. If it fails here the webhook
      // completes it, and the money has been taken either way, so the
      // customer goes to the success page rather than a failure screen.
      bundle = true
      const done = await completeBundlePayment(admin, transaction, 'paystack_verify')
      if (!done.ok) console.error('bundle completion on return from Paystack failed; the webhook will retry:', done.error)
      verified = true
    } else {
      // The plan and the account come from the payment, which our own server
      // labelled at checkout. The return address can be edited; this cannot.
      const bought = planForActivation(transaction, boughtCycle)
      if (!bought) {
        console.error('verify: a payment marked as Solo did not match a Solo plan', ref)
        redirect('/upgrade/cancel?reason=payment_failed')
      }
      boughtTier = bought.tier
      boughtCycle = bought.cycle
      const owner = String(txMetadata(transaction).user_id || user_id)
      const now = new Date()
      const periodEnd = new Date(now)

      if (boughtCycle === 'yearly') {
        periodEnd.setFullYear(periodEnd.getFullYear() + 1)
      } else {
        periodEnd.setMonth(periodEnd.getMonth() + 1)
      }

      // Delete-then-insert instead of upsert. whop_subscriptions has no
      // unique constraint on user_id, so .upsert({...}, { onConflict:
      // 'user_id' }) throws "no unique constraint matching the ON
      // CONFLICT specification" and silently leaves the user on Free.
      const { data: prior } = await admin
        .from('whop_subscriptions').select('*').eq('user_id', owner).maybeSingle()

      await admin.from('whop_subscriptions').delete().eq('user_id', owner)
      await admin.from('whop_subscriptions').insert({
        user_id: owner,
        email: transaction.customer.email,
        plan_id: planIdFor(boughtTier, boughtCycle),
        subscription_tier: boughtTier,
        billing_cycle: boughtCycle,
        status: 'active',
        receipt_id: ref,
        membership_id: transaction.subscription_code || ref,
        seats: 1,
        metadata: {
          paystack_reference: ref,
          paystack_subscription_code: transaction.subscription_code,
          amount: transaction.amount,
          currency: transaction.currency,
          period_end: periodEnd.toISOString(),
          paid_at: transaction.paid_at,
        },
      })

      await logSubscriptionChange(admin, {
        change: 'activated', userId: owner, email: transaction.customer.email,
        source: 'paystack_verify', reason: 'returned from Paystack checkout',
        before: prior,
        after: { plan_id: planIdFor(boughtTier, boughtCycle), status: 'active',
                 subscription_tier: boughtTier, billing_cycle: boughtCycle, seats: 1 },
      })

      verified = true
    }
  } catch (err) {
    // NEXT_REDIRECT is the internal exception next/navigation throws to
    // trigger the redirect - rethrow it so the redirect actually happens.
    if (err && typeof err === 'object' && 'digest' in err && typeof (err as { digest: unknown }).digest === 'string' && (err as { digest: string }).digest.startsWith('NEXT_REDIRECT')) {
      throw err
    }
    console.error('Paystack verify page error:', err)
    if (bundle) redirect('/upgrade/success?plan=yearly&bundle=1')
    redirect('/upgrade/cancel?reason=server_error')
  }

  if (verified) {
    redirect(bundle ? '/upgrade/success?plan=yearly&bundle=1' : `/upgrade/success?plan=${boughtCycle}${boughtTier === 'solo' ? '&tier=solo' : ''}`)
  }
  redirect('/upgrade/cancel?reason=server_error')
}
