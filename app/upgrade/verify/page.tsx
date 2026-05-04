import { redirect } from 'next/navigation'

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

    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()

    await supabase.from('whop_subscriptions').upsert({
      user_id,
      email: transaction.customer.email,
      plan_id: `paystack_${billingPlan}`,
      subscription_tier: 'pro',
      billing_cycle: billingPlan,
      status: 'active',
      receipt_id: ref,
      membership_id: ref,
      metadata: {
        paystack_reference: ref,
        amount: transaction.amount,
        currency: transaction.currency,
        period_end: periodEnd.toISOString(),
        paid_at: transaction.paid_at,
      },
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })

    redirect(`/upgrade/success?plan=${billingPlan}`)
  } catch {
    redirect('/upgrade/cancel?reason=server_error')
  }
}
