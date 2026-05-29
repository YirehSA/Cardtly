import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

// POST /api/team/cancel-invite
// Body: { card_id: string }
//
// Cancels a pending team-card invite. The card returns to the
// "Not invited" state and the existing claim link stops working
// immediately (token is cleared). The card itself is untouched -
// admin can still manage it and re-invite later.
//
// Only the org admin can call this. Refuses to act on a card
// that has already been claimed (use /api/team/revoke for that).

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

  const { card_id } = body
  if (!card_id) {
    return NextResponse.json({ error: 'Missing card_id' }, { status: 400 })
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  ) as any

  const { data: card } = await admin
    .from('team_cards')
    .select('id, organization_id, claimed_at')
    .eq('id', card_id)
    .maybeSingle()

  if (!card) {
    return NextResponse.json({ error: 'Card not found' }, { status: 404 })
  }
  if (card.claimed_at) {
    return NextResponse.json({
      error: 'Card is already claimed. Use revoke to remove the member.',
    }, { status: 409 })
  }

  const { data: org } = await admin
    .from('organizations')
    .select('id, admin_user_id')
    .eq('id', card.organization_id)
    .eq('admin_user_id', user.id)
    .maybeSingle()

  if (!org) {
    return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
  }

  // Clear all invite fields - card returns to "Not invited"
  const { error } = await admin
    .from('team_cards')
    .update({
      invite_email: null,
      invite_token: null,
      invite_sent_at: null,
    } as any)
    .eq('id', card_id)

  if (error) {
    console.error('cancel-invite update error', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
