import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

// POST /api/team/claim
// Body: { token: string, password: string }
//
// Invitee claims their team card. We look up the card by invite_token,
// create (or sign in) an auth.users record for invite_email, link the
// card via user_id + claimed_at, and clear the invite_token so it
// can't be reused.
//
// If a user already exists with this email, we sign them in by
// asking them to verify their existing password matches. If their
// password matches, we link the card to their existing account.
// This handles the case where a Cardtly free-tier user is invited
// to a team - they keep their existing account, just gain access
// to the team card.

export async function POST(request: Request) {
  let body: { token?: string; password?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const { token, password } = body
  if (!token || !password) {
    return NextResponse.json({ error: 'Missing token or password' }, { status: 400 })
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  ) as any

  // Find the card by invite_token
  const { data: card } = await admin
    .from('team_cards')
    .select('id, organization_id, name, invite_email, claimed_at')
    .eq('invite_token', token)
    .maybeSingle()

  if (!card) {
    return NextResponse.json({ error: 'Invite link is invalid or has expired' }, { status: 404 })
  }
  if (card.claimed_at) {
    return NextResponse.json({ error: 'This invite has already been claimed' }, { status: 409 })
  }
  if (!card.invite_email) {
    return NextResponse.json({ error: 'Invite is missing an email address' }, { status: 500 })
  }

  // Try to sign in with existing account first (in case they already have one)
  const supabase = await createClient()
  let userId: string | null = null

  // Check if user already exists by listing users with this email
  const { data: existingUsers } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const existingUser = (existingUsers?.users || []).find((u: any) =>
    u.email?.toLowerCase() === card.invite_email.toLowerCase()
  )

  if (existingUser) {
    // Verify their password by signing in
    const { data: signIn, error: signInErr } = await supabase.auth.signInWithPassword({
      email: card.invite_email,
      password,
    })
    if (signInErr || !signIn.user) {
      return NextResponse.json({
        error: 'An account with this email already exists. Enter your existing password to link the team card to it.',
      }, { status: 401 })
    }
    userId = signIn.user.id
  } else {
    // Create a new user account, auto-confirm email since the invite
    // email itself was the verification step.
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: card.invite_email,
      password,
      email_confirm: true,
      user_metadata: {
        team_invite: true,
        team_card_id: card.id,
      },
    })
    if (createErr || !created.user) {
      console.error('team claim createUser error', createErr)
      return NextResponse.json({
        error: createErr?.message || 'Could not create account',
      }, { status: 500 })
    }
    userId = created.user.id

    // Sign them in (sets the auth cookies)
    const { error: postSignErr } = await supabase.auth.signInWithPassword({
      email: card.invite_email,
      password,
    })
    if (postSignErr) {
      console.error('team claim post-create sign-in failed', postSignErr)
      // Not fatal — they can sign in manually after
    }
  }

  if (!userId) {
    return NextResponse.json({ error: 'Could not establish user' }, { status: 500 })
  }

  // Link the team card to the user, clear the invite token
  const { error: linkErr } = await admin
    .from('team_cards')
    .update({
      user_id: userId,
      claimed_at: new Date().toISOString(),
      invite_token: null,
    } as any)
    .eq('id', card.id)

  if (linkErr) {
    console.error('team claim link error', linkErr)
    return NextResponse.json({ error: 'Could not link card to your account' }, { status: 500 })
  }

  // Make sure they have a profiles row (needed for referrals, founder
  // counts, etc.). insert-or-ignore via upsert with onConflict.
  await admin
    .from('profiles')
    .upsert(
      { user_id: userId, name: card.name || '' } as any,
      { onConflict: 'user_id' }
    )

  return NextResponse.json({ success: true, card_id: card.id })
}
