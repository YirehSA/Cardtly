import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { newInviteToken, claimUrlFor, sendInviteEmail } from '@/lib/team-invite'

// POST /api/team/invite
// Body: { card_id: string, email: string, resend?: boolean }
//
// Issues (or re-issues) an invitation for a team card. Only the org
// admin can call this. Generates a random token, updates the card
// with invite_email/invite_token/invite_sent_at, and sends a
// branded email via Resend pointing to /team/claim/{token}.
//
// resend=true means the email is being re-issued for an existing
// invite (we reuse the existing token if it's still there).
//
// The token rules and the email itself live in lib/team-invite, shared with
// bulk import so the two cannot drift.

export async function POST(request: Request) {
  // Auth: caller must be signed in
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  }

  let body: { card_id?: string; email?: string; resend?: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const { card_id, email, resend: isResend } = body
  if (!card_id || !email) {
    return NextResponse.json({ error: 'Missing card_id or email' }, { status: 400 })
  }
  const trimmedEmail = email.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
    return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  ) as any

  // Load the card + verify the caller is the admin of the owning org
  const { data: card, error: cardErr } = await admin
    .from('team_cards')
    .select('id, name, organization_id, user_id, invite_token, claimed_at')
    .eq('id', card_id)
    .maybeSingle()

  if (cardErr || !card) {
    return NextResponse.json({ error: 'Card not found' }, { status: 404 })
  }
  if (card.claimed_at) {
    return NextResponse.json({ error: 'Card has already been claimed' }, { status: 409 })
  }

  const { data: org, error: orgErr } = await admin
    .from('organizations')
    .select('id, name, admin_user_id')
    .eq('id', card.organization_id)
    .eq('admin_user_id', user.id)
    .maybeSingle()

  if (orgErr || !org) {
    return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
  }

  // Resolve the inviting admin's name for the email body
  const { data: adminProfile } = await admin
    .from('profiles')
    .select('name')
    .eq('user_id', user.id)
    .maybeSingle()
  const inviterName = (adminProfile as any)?.name || user.email || 'A team admin'

  // Token reuse rule:
  //   * resend with the SAME email -> keep the existing token so the
  //     old email's link is still valid (no orphan link)
  //   * email CHANGED (admin fixing a typo or sending to a different
  //     person) -> generate a fresh token. That immediately
  //     invalidates the old email's link so whoever received it
  //     can't claim the card anymore.
  //   * first-time invite -> generate a fresh token.
  const previousEmail = (card as any).invite_email as string | null
  const emailChanged = !!previousEmail && previousEmail !== trimmedEmail
  const token = (isResend && card.invite_token && !emailChanged)
    ? card.invite_token as string
    : newInviteToken()

  // Update the card with invite details
  const { error: updErr } = await admin
    .from('team_cards')
    .update({
      invite_email: trimmedEmail,
      invite_token: token,
      invite_sent_at: new Date().toISOString(),
    } as any)
    .eq('id', card_id)

  if (updErr) {
    console.error('team invite update error', updErr)
    return NextResponse.json({ error: updErr.message }, { status: 500 })
  }

  // Send the invite email via Resend
  const claimUrl = claimUrlFor(token)
  if (process.env.RESEND_API_KEY) {
    const { sent, error } = await sendInviteEmail({
      to: trimmedEmail,
      orgName: org.name,
      inviterName,
      cardName: card.name || 'your team card',
      claimUrl,
    })
    if (!sent) {
      console.error('team invite email failed', error)
      return NextResponse.json({ error: 'Could not send email' }, { status: 500 })
    }
  }

  return NextResponse.json({ success: true, claim_url: claimUrl })
}
