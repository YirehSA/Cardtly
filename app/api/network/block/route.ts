import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

// POST /api/network/block
// Body: { card_id? , team_card_id?, unblock?: boolean }
//
// One person choosing not to see another. It takes effect on their own
// Network the moment it is saved and changes nothing for anybody else.
//
// Kept separate from reporting on purpose. Blocking is immediate and needs no
// judgement; a report asks somebody to make one. Rolling them together would
// mean either a block that waits for review, or a report that quietly removes
// somebody from a directory on one person's say-so.

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in to block someone.' }, { status: 401 })

  let body: any
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }) }

  const { card_id, team_card_id, unblock } = body
  if (!card_id === !team_card_id) {
    return NextResponse.json({ error: 'Say which card this is about.' }, { status: 400 })
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  ) as any

  const column = card_id ? 'card_id' : 'team_card_id'
  const value = card_id || team_card_id

  if (unblock) {
    const { error } = await admin
      .from('network_blocks').delete().eq('user_id', user.id).eq(column, value)
    if (error) return NextResponse.json({ error: 'Could not undo that.' }, { status: 500 })
    return NextResponse.json({ success: true, blocked: false })
  }

  const { error } = await admin.from('network_blocks').insert({
    user_id: user.id,
    card_id: card_id || null,
    team_card_id: team_card_id || null,
  })

  if (error) {
    // 23505: already blocked. That is the state the caller asked for, so it is
    // a success, not an error - reporting a failure would make the button look
    // broken to somebody who simply clicked it twice.
    if (error.code === '23505') return NextResponse.json({ success: true, blocked: true })
    if (error.code === '42P01') {
      return NextResponse.json({ error: 'Blocking is not enabled yet.' }, { status: 503 })
    }
    return NextResponse.json({ error: 'Could not block that card.' }, { status: 500 })
  }

  return NextResponse.json({ success: true, blocked: true })
}
