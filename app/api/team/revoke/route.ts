import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

// POST /api/team/revoke
// Body: { card_id: string }
//
// Removes a team member's access to a previously-claimed card.
// The card returns to the unclaimed admin-managed state. The
// member's user account is NOT deleted - they keep their Cardtly
// login and any personal data - they just lose ownership of this
// team card. Admin can re-invite the same or different person.
//
// Only the org admin can call this. Refuses to act on a card
// that hasn't been claimed (use /api/team/cancel-invite for that).

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
    .select('id, organization_id, user_id, claimed_at')
    .eq('id', card_id)
    .maybeSingle()

  if (!card) {
    return NextResponse.json({ error: 'Card not found' }, { status: 404 })
  }
  if (!card.claimed_at) {
    return NextResponse.json({
      error: 'Card has not been claimed. Nothing to revoke.',
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

  // Clear ownership + invite fields, and take the card off the air.
  //
  // is_active: false is the important half. Revoking used to sever the member
  // link and leave the card published, so an offboarded employee's name,
  // photo, email and phone carried on being served at their public URL and in
  // the vCard download, indefinitely, to anyone who had ever tapped their NFC
  // card. Removing someone's access has to mean their details stop being
  // handed out, which is both what an admin pressing this expects and what
  // POPIA requires on offboarding.
  //
  // The card content is still preserved, so the admin keeps managing it and
  // can re-issue it to a replacement: inviting somebody sets is_active back to
  // true. The row is not deleted, so the slug survives for the next holder.
  const { error } = await admin
    .from('team_cards')
    .update({
      user_id: null,
      claimed_at: null,
      invite_email: null,
      invite_token: null,
      invite_sent_at: null,
      is_active: false,
    } as any)
    .eq('id', card_id)

  if (error) {
    console.error('revoke update error', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
