import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { isIosAppUA } from '@/lib/app-platform'
import { startSoloTrial } from '@/lib/signup-trial'

// Start the 7-day Cardtly Solo trial: the quiet fallback for somebody who will
// not choose a plan (lib/signup-trial). The signed-in user's own account only.

export async function POST(request: Request) {
  // The iOS app is for company teams; nothing personal starts there.
  if (isIosAppUA(request.headers.get('user-agent'))) {
    return NextResponse.json({ error: 'Not available in the app.' }, { status: 403 })
  }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 })

  // Service role: trial_tier and trial_ends_at are not writable by the user
  // (migration 083's column grants), on purpose.
  const result = await startSoloTrial(createServiceClient() as any, user.id)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json({ ok: true, endsAt: result.endsAt })
}
