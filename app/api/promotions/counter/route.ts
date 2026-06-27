import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/promotions/counter
// Public endpoint that returns the current Tier 1 founder count.
// Backed by the founder_count() SECURITY DEFINER function (migration
// 022), granted to anon. Used by the /promotions client to poll every
// 30s and keep the "X / 100 founder slots remaining" UI in sync.

export async function GET() {
  const supabase = await createClient() as any
  const { data, error } = await supabase.rpc('founder_count')
  if (error) {
    return NextResponse.json({ error: 'Counter unavailable' }, { status: 500 })
  }
  // The function returns a single row as a one-element array.
  const row = Array.isArray(data) ? data[0] : data
  return NextResponse.json({
    filled: row?.filled ?? 0,
    remaining: row?.remaining ?? 100,
    total: row?.total ?? 100,
  })
}
