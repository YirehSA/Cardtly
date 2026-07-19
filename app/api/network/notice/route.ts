import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/network/notice
//
// Records that this user has seen the one-time Network listing notice.
//
// Written to the database rather than local storage on purpose: the Network
// lists people by default, so "we told them" is a fact worth being able to
// show, and a flag in one browser is neither durable nor evidence.
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  }

  // Only stamps if it is still null, so re-acknowledging cannot move the date
  // of the notice they were actually shown.
  const { data, error } = await supabase
    .from('profiles')
    .update({ network_notice_seen_at: new Date().toISOString() } as any)
    .eq('user_id', user.id)
    .is('network_notice_seen_at', null)
    .select('user_id')

  if (error) {
    console.error('network notice ack error', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // No row back means it was already acknowledged, which is a success from the
  // caller's point of view - the notice should stay dismissed either way.
  return NextResponse.json({ success: true, firstAck: !!data?.length })
}
