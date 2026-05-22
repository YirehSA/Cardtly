import { redirect } from 'next/navigation'
import { createClient as createAdminClient } from '@supabase/supabase-js'

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
    const now = new Date()
    const periodEnd = new Date(now)

    if (billingPlan === 'yearly') {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1)
    } else {
      periodEnd.setMonth(periodEnd.getMonth() + 1)
    }

    // Service-role client - whop_subscriptions RLS blocks user-scoped
    // inserts, and only the server should be flipping users to Pro.
    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    ) as any

    // Delete-then-insert instead of upsert. whop_subscriptions has no
    // unique constraint on user_id, so .upsert({...}, { onConflict:
    // 'user_id' }) throws "no unique constraint matching the ON
    // CONFLICT specification" and silently leaves the user on Free.
    await admin.from('whop_subscriptions').delete().eq('user_id', user_id)
    await admin.from('whop_subscriptions').insert({
      user_id,
      email: transaction.customer.email,
      plan_id: `paystack_${billingPlan}`,
      subscription_tier: 'pro',
      billing_cycle: billingPlan,
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

    verified = true
  } catch (err) {
    // NEXT_REDIRECT is the internal exception next/navigation throws to
    // trigger the redirect - rethrow it so the redirect actually happens.
    if (err && typeof err === 'object' && 'digest' in err && typeof (err as { digest: unknown }).digest === 'string' && (err as { digest: string }).digest.startsWith('NEXT_REDIRECT')) {
      throw err
    }
    console.error('Paystack verify page error:', err)
    redirect('/upgrade/cancel?reason=server_error')
  }

  if (verified) {
    redirect(`/upgrade/success?plan=${billingPlan}`)
  }
  redirect('/upgrade/cancel?reason=server_error')
}
