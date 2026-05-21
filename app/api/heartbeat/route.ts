import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

// Lightweight heartbeat to track when a user was last active. Called
// every few minutes from the client whenever the dashboard is open.
// Powers the "Online now" / "Active 2h ago" indicator on public cards
// for users who have opted in via Settings.

export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ ok: false }, { status: 401 })

    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    ) as any

    await admin.from('profiles').update({
      last_active_at: new Date().toISOString(),
    }).eq('user_id', user.id)

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: true })
  }
}
