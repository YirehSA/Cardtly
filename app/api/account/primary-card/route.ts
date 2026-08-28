import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

// POST /api/account/primary-card
// Body: { card_id: string, kind: 'personal' | 'team' }
//
// Chooses which of a person's cards their link opens.
//
// Signing up creates a personal card; joining a team later creates a second
// one in another table. Somebody who did both ended up with two live URLs,
// two view counts and two piles of leads, and nothing said the other existed.
//
// Neither card is deleted. The loser keeps its leads, its history and its
// slug, and forwards to the winner, so anything already printed still lands
// somewhere correct. Reversible at any time by choosing the other one.

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  let body: { card_id?: string; kind?: string }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }
  const { card_id, kind } = body
  if (!card_id || (kind !== 'personal' && kind !== 'team')) {
    return NextResponse.json({ error: 'card_id and kind are required' }, { status: 400 })
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  ) as any

  // Both sides are read as this user's own. A card_id belonging to somebody
  // else simply is not in these lists, so ownership is established by the
  // query rather than by trusting the body.
  const [{ data: personal }, { data: team }] = await Promise.all([
    admin.from('cards').select('id, slug, name').eq('user_id', user.id),
    admin.from('team_cards').select('id, slug, name').eq('user_id', user.id).eq('is_active', true),
  ])

  const mine = [
    ...(personal || []).map((c: any) => ({ ...c, kind: 'personal' as const })),
    ...(team || []).map((c: any) => ({ ...c, kind: 'team' as const })),
  ].filter(c => c.slug)

  const winner = mine.find(c => c.id === card_id && c.kind === kind)
  if (!winner) {
    return NextResponse.json({ error: 'That is not one of your cards' }, { status: 404 })
  }
  if (mine.length < 2) {
    return NextResponse.json({ error: 'You only have one card, so there is nothing to choose between.' }, { status: 409 })
  }

  // The winner is cleared first. Doing it the other way round leaves a window
  // where both point at each other, and the public route would bounce between
  // them until the browser gave up.
  const clear = await admin
    .from(kind === 'personal' ? 'cards' : 'team_cards')
    .update({ redirect_to_slug: null })
    .eq('id', winner.id)

  if (clear.error) {
    // 42703 is undefined_column: migration 058 has not been applied yet.
    if (clear.error.code === '42703') {
      return NextResponse.json({
        error: 'This is not switched on yet. The database migration for it has not been applied.',
      }, { status: 503 })
    }
    console.error('primary-card clear error', clear.error)
    return NextResponse.json({ error: clear.error.message }, { status: 500 })
  }

  for (const c of mine) {
    if (c.id === winner.id) continue
    await admin
      .from(c.kind === 'personal' ? 'cards' : 'team_cards')
      .update({ redirect_to_slug: winner.slug })
      .eq('id', c.id)
  }

  return NextResponse.json({
    success: true,
    primary: { id: winner.id, slug: winner.slug, kind: winner.kind },
    redirected: mine.filter(c => c.id !== winner.id).map(c => c.slug),
  })
}
