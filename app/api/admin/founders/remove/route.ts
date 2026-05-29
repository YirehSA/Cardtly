import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

// POST /api/admin/founders/remove
// Body: { user_id: string }
//
// Strips founder status from a user so the slot returns to the
// pool. Used to clean up test accounts, Play Store reviewer
// signups that tripped the trigger, etc. Slot reuse: migration
// 007 makes the next organic signup pick the lowest unused
// number 1..100, so removing slot #5 means the next signup
// claims #5.
//
// Side effect: if the user is currently on the founder 3-month
// grant (plan_id = 'founder_3m'), we cancel that subscription
// too - they shouldn't keep Pro for free if they're no longer
// a founder. A user who upgraded with their own card stays Pro.
//
// Only the hardcoded admin (info@yireh.co.za) can call this.

const ADMIN_USER_ID = '6216ca40-72e5-47f2-af6a-a37d35f9d169'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.id !== ADMIN_USER_ID) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: { user_id?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const { user_id } = body
  if (!user_id) {
    return NextResponse.json({ error: 'Missing user_id' }, { status: 400 })
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  ) as any

  // Strip founder fields. Keep referral_code etc. intact.
  const { error: profErr } = await admin
    .from('profiles')
    .update({
      is_founder: false,
      founder_number: null,
      founder_lifetime_pro: false,
    } as any)
    .eq('user_id', user_id)

  if (profErr) {
    console.error('founder remove: profile update error', profErr)
    return NextResponse.json({ error: profErr.message }, { status: 500 })
  }

  // Cancel the founder 3-month grant if it's still the active sub.
  // Users who later upgraded to a real paid plan keep that sub.
  const { error: subErr } = await admin
    .from('whop_subscriptions')
    .delete()
    .eq('user_id', user_id)
    .eq('plan_id', 'founder_3m')

  if (subErr) {
    console.error('founder remove: sub delete error', subErr)
    // Non-fatal: profile is updated. Log and continue.
  }

  return NextResponse.json({ success: true })
}
