import { redirect } from 'next/navigation'

// Paystack redirects back with ?reference=xxx&trxref=xxx
// We pick that up here and call our verify API, then redirect to success or cancel
export default async function VerifyPage({
  searchParams,
}: {
  searchParams: { reference?: string; trxref?: string; plan?: string; user_id?: string }
}) {
  const reference = searchParams.reference || searchParams.trxref
  const plan = searchParams.plan || 'monthly'
  const userId = searchParams.user_id

  if (!reference || !userId) {
    redirect('/upgrade/cancel?reason=missing_params')
  }

  // Verify directly in the server component
  try {
    const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      },
      cache: 'no-store',
    })

    const data = await response.json()

    if (!data.status || data.data.status !== 'success') {
      redirect('/upgrade/cancel?reason=payment_failed')
    }

    const transaction = data.data

    // Calculate period end
    const now = new Date()
    const periodEnd = new Date(now)
    if (plan === 'yearly') {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1)
    } else {
      periodEnd.setMonth(periodEnd.getMonth() + 1)
    }

    // Activate subscription via supabase
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()

    await supabase.from('whop_subscriptions').upsert({
      user_id: userId,
      email: transaction.customer.email,
      plan_id: `paystack_${plan}`,
      subscription_tier: 'pro',
      billing_cycle: plan,
      status: 'active',
      receipt_id: reference,
      membership_id: reference,
      metadata: {
        paystack_reference: reference,
        amount: transaction.amount,
        currency: transaction.currency,
        period_end: periodEnd.toISOString(),
        paid_at: transaction.paid_at,
        channel: transaction.channel,
      },
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })

    redirect(`/upgrade/success?plan=${plan}`)
  } catch {
    redirect('/upgrade/cancel?reason=server_error')
  }
}
