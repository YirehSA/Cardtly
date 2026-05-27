import { NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

// POST /api/promotions/grant-founder
// Body: { user_id }
//
// If the user is a founder (assigned by the DB trigger during signup)
// AND they don't already have an active Pro subscription, grant them
// a 3-month Pro subscription as their founder reward.
//
// Idempotent: safe to call multiple times. If the user isn't a
// founder, or already has Pro, this is a no-op.
//
// The 10 lifetime winners are picked separately at a public draw
// (see /api/promotions/tier1-draw) and their subscription is upgraded
// from 'founder_3m' to 'founder_lifetime' at that point.

export async function POST(request: Request) {
  let body: { user_id?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { user_id } = body
  if (!user_id) {
    return NextResponse.json({ error: 'Missing user_id' }, { status: 400 })
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  ) as any

  try {
    // 1. Is this user a founder?
    const { data: profile } = await admin
      .from('profiles')
      .select('user_id, name, founder_number, is_founder')
      .eq('user_id', user_id)
      .maybeSingle()

    if (!profile?.is_founder) {
      // Not a founder - nothing to do. Either Tier 1 already closed
      // or the trigger didn't fire.
      return NextResponse.json({ success: true, granted: false, reason: 'not_a_founder' })
    }

    // 2. Do they already have an active subscription? (Idempotent guard)
    const { data: existing } = await admin
      .from('whop_subscriptions')
      .select('id, plan_id, status')
      .eq('user_id', user_id)
      .eq('status', 'active')
      .maybeSingle()

    if (existing) {
      return NextResponse.json({
        success: true,
        granted: false,
        reason: 'already_has_subscription',
        existing_plan: existing.plan_id,
      })
    }

    // 3. Grant the 3-month founder Pro
    // Period end: 90 days from now
    const now = new Date()
    const periodEnd = new Date(now)
    periodEnd.setDate(periodEnd.getDate() + 90)

    // Fetch the user's email for the subscription record
    const { data: { user: authUser } } = await admin.auth.admin.getUserById(user_id)
    const email = authUser?.email || ''

    // Delete-then-insert per the project's whop_subscriptions pattern
    // (no unique constraint on user_id, so upsert errors out)
    await admin.from('whop_subscriptions').delete().eq('user_id', user_id)
    const { error: insertError } = await admin.from('whop_subscriptions').insert({
      user_id,
      email,
      plan_id: 'founder_3m',
      subscription_tier: 'pro',
      billing_cycle: 'founder',
      status: 'active',
      membership_id: `founder_${profile.founder_number}`,
      receipt_id: `founder_${profile.founder_number}`,
      seats: 1,
      metadata: {
        founder_number: profile.founder_number,
        grant_type: '3_month_pro',
        period_end: periodEnd.toISOString(),
        granted_at: now.toISOString(),
      },
    })

    if (insertError) {
      console.error('Founder grant insert error:', insertError)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      granted: true,
      founder_number: profile.founder_number,
      expires_at: periodEnd.toISOString(),
    })
  } catch (err) {
    console.error('grant-founder error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
