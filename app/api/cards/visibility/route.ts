import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/cards/visibility
// Body: { card_id: string, allow_homepage_feature: boolean }
//
// Toggles the homepage-feature opt-in flag on a single card.
// Caller must own the card; we verify via the signed-in user id
// rather than trusting the body alone.

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  }

  let body: { card_id?: string; allow_homepage_feature?: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const { card_id, allow_homepage_feature } = body
  if (!card_id || typeof allow_homepage_feature !== 'boolean') {
    return NextResponse.json({ error: 'Missing card_id or allow_homepage_feature' }, { status: 400 })
  }

  // Update only if the caller owns the card
  const { data, error } = await supabase
    .from('cards')
    .update({ allow_homepage_feature, updated_at: new Date().toISOString() } as any)
    .eq('id', card_id)
    .eq('user_id', user.id)
    .select('id')
    .maybeSingle()

  if (error) {
    console.error('visibility update error', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!data) {
    return NextResponse.json({ error: 'Card not found or not owned by you' }, { status: 404 })
  }

  return NextResponse.json({ success: true, allow_homepage_feature })
}
