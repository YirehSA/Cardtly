import { NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

// POST /api/referrals/track
// Body: { user_id: <new user uuid>, referral_code: <6-char code> }
//
// Looks up the referrer by their code and creates a referrals row
// linking referrer -> new user. Uses the service-role client because
// the referrals table has no client-write RLS policy (all writes go
// through this route).
//
// Returns:
//   { success: true }                       - referral row created
//   { success: true, alreadyReferred: true } - duplicate referral, no-op
//   { error: '...' }                         - invalid code / self-referral

const CODE_RE = /^[A-HJ-NP-Z2-9]{6}$/

export async function POST(request: Request) {
  let body: { user_id?: string; referral_code?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { user_id, referral_code } = body
  if (!user_id || !referral_code) {
    return NextResponse.json({ error: 'Missing user_id or referral_code' }, { status: 400 })
  }

  const code = referral_code.trim().toUpperCase()
  if (!CODE_RE.test(code)) {
    return NextResponse.json({ error: 'Invalid referral code format' }, { status: 400 })
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  ) as any

  try {
    // Look up the referrer by their code
    const { data: referrer, error: lookupError } = await admin
      .from('profiles')
      .select('user_id')
      .eq('referral_code', code)
      .maybeSingle()

    if (lookupError) {
      console.error('Referral lookup error:', lookupError)
      return NextResponse.json({ error: 'Database error during lookup' }, { status: 500 })
    }

    if (!referrer?.user_id) {
      return NextResponse.json({ error: 'Referral code not found' }, { status: 404 })
    }

    // Block self-referral
    if (referrer.user_id === user_id) {
      return NextResponse.json({ error: 'Cannot refer yourself' }, { status: 400 })
    }

    // Insert the referral row
    const { error: insertError } = await admin
      .from('referrals')
      .insert({
        referrer_user_id: referrer.user_id,
        referred_user_id: user_id,
        status: 'pending',
      })

    if (insertError) {
      // 23505 = unique constraint violation. user was already referred
      // by someone (possibly this same referrer). Treat as success
      // since the relationship is already recorded.
      if ((insertError as any).code === '23505') {
        return NextResponse.json({ success: true, alreadyReferred: true })
      }
      console.error('Referral insert error:', insertError)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Referral track error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
