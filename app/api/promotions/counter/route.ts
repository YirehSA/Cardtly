import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/promotions/counter
// Public endpoint that returns the current Tier 1 founder count.
// Backed by the founder_count view which is granted to anon.
// Used by the /promotions client to poll every 30s and keep the
// "X / 100 founder slots remaining" UI in sync.

export async function GET() {
  const supabase = await createClient() as any
  const { data, error } = await supabase.from('founder_count').select('*').maybeSingle()
  if (error) {
    return NextResponse.json({ error: 'Counter unavailable' }, { status: 500 })
  }
  return NextResponse.json({
    filled: data?.filled ?? 0,
    remaining: data?.remaining ?? 100,
    total: data?.total ?? 100,
  })
}
