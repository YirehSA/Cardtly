import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { isAdminUser } from '@/lib/admin-check'
import { newInviteToken, claimUrlFor } from '@/lib/team-invite'

// POST /api/admin/claim-link
// Body: { card_id: string }
//
// The claim link for one unclaimed team card, on demand.
//
// Testing an import means opening the link the invitee would have received,
// and that lives in an inbox nobody here can reach. The alternative - an admin
// button that force-assigns a card to an account - would skip the very flow
// being tested and prove nothing. This hands over the real link, so the real
// journey runs: set a password, land on the card, see it claimed.
//
// It doubles as the answer to "they never got the email", which is otherwise
// a resend and a shrug.
//
// One card per request, never a list. The token is a bearer credential:
// whoever holds it can take that card. Shipping every unclaimed token to the
// browser on page load would put hundreds of them in a devtools tab, a
// screenshot and a bug report, for the sake of a button most of them will
// never need.

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  if (!(await isAdminUser(user.id))) {
    return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
  }

  let body: { card_id?: string }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }
  if (!body.card_id) {
    return NextResponse.json({ error: 'card_id is required' }, { status: 400 })
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  ) as any

  const { data: card } = await admin
    .from('team_cards')
    .select('id, name, invite_email, invite_token, claimed_at, organization_id')
    .eq('id', body.card_id)
    .maybeSingle()

  if (!card) return NextResponse.json({ error: 'Card not found' }, { status: 404 })
  if (card.claimed_at) {
    return NextResponse.json({
      error: 'That card has already been claimed. There is nothing left to accept.',
    }, { status: 409 })
  }

  // A card imported without sending invitations has no token at all. Minting
  // one here is what the invite route would have done, and means the link
  // works for a card that was created and never emailed - which is exactly
  // the state a spreadsheet import leaves them in.
  let token: string = card.invite_token
  let minted = false
  if (!token) {
    token = newInviteToken()
    const { error } = await admin
      .from('team_cards')
      .update({ invite_token: token })
      .eq('id', card.id)
    if (error) {
      console.error('claim-link token error', error)
      return NextResponse.json({ error: 'Could not prepare a link for that card' }, { status: 500 })
    }
    minted = true
  }

  // Handing out a credential is worth a record. Best effort on the write, but
  // the column names are checked against the real table rather than guessed:
  // a log that silently fails inside its own catch is worse than no log,
  // because it reads as coverage.
  const { error: logError } = await admin.from('admin_audit_log').insert({
    actor_user_id: user.id,
    actor_email: user.email ?? null,
    action: 'team_card_claim_link_revealed',
    target_email: card.invite_email ?? null,
    detail: `${card.name || card.id}${minted ? ' (token minted)' : ''}`,
    ok: true,
  })
  if (logError) console.error('claim-link audit write failed', logError)

  return NextResponse.json({
    url: claimUrlFor(token),
    cardName: card.name || null,
    inviteEmail: card.invite_email || null,
    minted,
  })
}
