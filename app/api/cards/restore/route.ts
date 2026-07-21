import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

// POST /api/cards/restore
// Body: { card_id: string }
//
// Puts an archived card back online.
//
// An archived card is invisible to the public: the RLS policy that serves
// /card/[slug] matches archived = false, so the page 404s for everyone while
// still looking healthy in the owner's dashboard, which reads it as the owner
// rather than anonymously.
//
// Clearing the flag alone is not enough. A BEFORE INSERT/UPDATE trigger,
// assert_card_assignment_consistency, does:
//
//     IF NEW.assigned_user_id IS NULL THEN NEW.archived := true;
//
// so an unassigned card is re-archived by the same statement that tried to
// restore it - silently, with no error. Both fields therefore move together.
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  }

  let body: { card_id?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }
  if (!body.card_id) {
    return NextResponse.json({ error: 'Missing card_id' }, { status: 400 })
  }

  // Service role throughout: an archived card is unreadable to a member
  // through the user-scoped client, since the policies that would grant
  // access require archived = false. Ownership is checked here instead,
  // against user_id, and never taken from the request body.
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  ) as any

  const { data: card } = await admin
    .from('cards')
    .select('id, user_id, slug')
    .eq('id', body.card_id)
    .maybeSingle()

  if (!card) {
    return NextResponse.json({ error: 'Card not found' }, { status: 404 })
  }
  if (card.user_id !== user.id) {
    return NextResponse.json({ error: 'Not your card' }, { status: 403 })
  }

  const { data: updated, error } = await admin
    .from('cards')
    .update({ assigned_user_id: card.user_id, archived: false })
    .eq('id', card.id)
    .select('id, archived, slug')

  if (error) {
    console.error('card restore failed', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Read the flag back rather than trusting a missing error. This exact
  // update reports success while changing nothing when the trigger overrides
  // it, which is what made the original diagnosis take so long.
  const row = updated?.[0]
  if (!row || row.archived !== false) {
    console.error('card restore did not stick', { card_id: card.id, row })
    return NextResponse.json(
      { error: 'The card could not be restored. Please contact support.' },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true, slug: row.slug })
}
